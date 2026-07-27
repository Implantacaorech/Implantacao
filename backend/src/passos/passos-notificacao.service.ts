import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { Documento } from '../database/entities/documento.entity';
import { UsersService } from '../users/users.service';
import { MailerService } from '../email/mailer.service';
import { Anexo } from '../email/anexo';
import { DefinicaoPasso } from './passos.constants';
import {
  ANEXO_POR_PASSO,
  DestinatarioPasso,
  EMAIL_POR_PASSO,
  EmailDePasso,
  TOKENS_PASSO,
} from './passos-email.constants';

/** Dispara o e-mail de cada passo do processo e registra na timeline do projeto.
 *
 * Não bloqueia quem concluiu o passo: o envio roda em segundo plano (`void`), do mesmo jeito
 * que `NotificacaoService` já fazia. Falha de e-mail NÃO desfaz a conclusão do passo — o
 * passo aconteceu de verdade; o que fica registrado é a notificação pendente. */
@Injectable()
export class PassosNotificacaoService {
  private readonly logger = new Logger('PassosNotificacaoService');

  constructor(
    @InjectRepository(Evento) private readonly eventos: Repository<Evento>,
    @InjectRepository(ProjetoPessoa)
    private readonly pessoas: Repository<ProjetoPessoa>,
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    private readonly mailer: MailerService,
    private readonly users: UsersService,
  ) {}

  /** Documento mais RECENTE do tipo pedido, como anexo — ou nada se não houver. O arquivo
   * pode ter sumido do disco; nesse caso o próprio envio ignora o anexo em silêncio, mas
   * conferimos aqui para não anunciar "em anexo" um arquivo que não existe mais. */
  private async anexoDoPasso(
    projetoId: number,
    passo: number,
  ): Promise<Anexo[]> {
    const tipo = ANEXO_POR_PASSO[passo];
    if (!tipo) return [];
    const doc = await this.documentos.findOne({
      where: { projetoId, tipo },
      order: { criadoEm: 'DESC' },
    });
    if (!doc || !doc.caminho || !existsSync(doc.caminho)) return [];
    return [{ caminho: doc.caminho, nomeArquivo: doc.arquivo || undefined }];
  }

  /** Converte nomes de pessoa (como gravados no projeto) nos e-mails do cadastro. O login
   * É o e-mail no Painel — mesma convenção de `NotificacaoService.emailsCoordenacao`. */
  private async emailsDeNomes(nomes: string[]): Promise<string[]> {
    const limpos = nomes.map((n) => n.trim()).filter(Boolean);
    if (limpos.length === 0) return [];
    const todos = await this.users.listar();
    return todos
      .filter((u) => u.ativo && limpos.includes(u.nome))
      .map((u) => u.email || u.login)
      .filter(Boolean);
  }

  private async emailsDePerfil(
    perfil: 'ADM' | 'Coordenador' | 'Administrativo',
  ) {
    const usuarios = await this.users.porPerfil(perfil);
    return usuarios
      .filter((u) => u.ativo)
      .map((u) => u.email || u.login)
      .filter(Boolean);
  }

  /** Resolve um grupo de destinatário em endereços de e-mail. */
  async resolverDestino(
    grupo: DestinatarioPasso,
    projeto: Projeto,
  ): Promise<string[]> {
    switch (grupo) {
      case 'administrativo':
        return this.emailsDePerfil('Administrativo');
      case 'coordenacao': {
        const [adm, coord] = await Promise.all([
          this.emailsDePerfil('ADM'),
          this.emailsDePerfil('Coordenador'),
        ]);
        return [...adm, ...coord];
      }
      case 'gci':
        return this.emailsDeNomes([projeto.gci]);
      case 'consultores': {
        // A fonte da verdade são os vínculos por papel; `Projeto.consultor` é só o espelho.
        const vinculos = await this.pessoas.find({
          where: { projetoId: projeto.id, papel: 'consultor' },
        });
        const nomes =
          vinculos.length > 0
            ? vinculos.map((v) => v.pessoa)
            : projeto.consultor.split(',');
        return this.emailsDeNomes(nomes);
      }
      case 'comercial':
        return [projeto.comercialEmail].map((e) => e.trim()).filter(Boolean);
      case 'cliente':
        return [projeto.contatoEmail].map((e) => e.trim()).filter(Boolean);
    }
  }

  private aplicarTokens(texto: string, projeto: Projeto): string {
    let saida = texto;
    for (const [token, campo] of Object.entries(TOKENS_PASSO)) {
      const valor = (projeto as unknown as Record<string, unknown>)[campo];
      saida = saida.split(token).join(typeof valor === 'string' ? valor : '');
    }
    return saida;
  }

  /** Monta o e-mail do passo sem enviar — usado pelo teste e pela pré-visualização. */
  async montar(
    projeto: Projeto,
    passo: number,
  ): Promise<{ para: string[]; assunto: string; corpo: string } | null> {
    const modelo: EmailDePasso | undefined = EMAIL_POR_PASSO.get(passo);
    if (!modelo) return null;
    const listas = await Promise.all(
      modelo.para.map((g) => this.resolverDestino(g, projeto)),
    );
    const para = [...new Set(listas.flat())];
    return {
      para,
      assunto: this.aplicarTokens(modelo.assunto, projeto),
      corpo: this.aplicarTokens(modelo.corpo, projeto),
    };
  }

  /** Envia o e-mail do passo, se houver, e registra o resultado na timeline. */
  async notificarPasso(
    projeto: Projeto,
    def: DefinicaoPasso,
    autor: string,
  ): Promise<void> {
    try {
      const email = await this.montar(projeto, def.numero);
      if (!email) return;

      if (email.para.length === 0) {
        // Sem destinatário não há o que enviar, mas o processo previa um e-mail aqui —
        // fica registrado para alguém resolver (ex.: passo 3 sem o e-mail do Comercial).
        await this.registrar(
          projeto.id,
          `Passo ${def.numero}: e-mail não enviado — nenhum destinatário resolvido (${def.titulo}).`,
          autor,
        );
        return;
      }

      const anexos = await this.anexoDoPasso(projeto.id, def.numero);

      let ok = false;
      let erro = 'e-mail não configurado';
      if (this.mailer.configurado()) {
        const r = await this.mailer.enviar(
          email.para,
          email.assunto,
          email.corpo,
          anexos,
        );
        ok = r.ok;
        erro = r.erro ?? '';
      }
      const comAnexo =
        anexos.length > 0
          ? ` (anexo: ${anexos[0].nomeArquivo ?? 'documento'})`
          : '';
      await this.registrar(
        projeto.id,
        ok
          ? `Passo ${def.numero}: e-mail enviado a ${email.para.join(', ')}${comAnexo} — ${email.assunto}`
          : `Passo ${def.numero}: e-mail PENDENTE (${email.assunto}): ${erro || '?'}`,
        autor,
      );
    } catch (e) {
      this.logger.error(
        `Falha ao notificar o passo ${def.numero} (projetoId=${projeto.id})`,
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  private async registrar(
    projetoId: number,
    descricao: string,
    autor: string,
  ): Promise<void> {
    await this.eventos.save(
      this.eventos.create({ projetoId, tipo: 'email', descricao, autor }),
    );
  }
}
