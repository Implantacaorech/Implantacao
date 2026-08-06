import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import {
  PapelProjeto,
  ProjetoPessoa,
} from '../database/entities/projeto-pessoa.entity';
import { ProjetoPasso } from '../database/entities/projeto-passo.entity';
import { Documento } from '../database/entities/documento.entity';
import { EmailPasso } from '../database/entities/email-passo.entity';
import { ModeloEmail } from '../database/entities/modelo-email.entity';
import { UsersService } from '../users/users.service';
import { MailerService } from '../email/mailer.service';
import { Anexo } from '../email/anexo';
import { DefinicaoPasso, nomesDoCampo } from './passos.constants';
import { DestinatariosPassoService } from './destinatarios-passo.service';
import {
  ANEXO_POR_PASSO,
  DestinatarioPasso,
  EMAIL_POR_PASSO,
  TOKENS_PASSO,
} from './passos-email.constants';

/** Nome do tipo com que ficam guardados os arquivos que a PESSOA anexou ao e-mail de um
 * passo (`PASSOS_COM_ANEXO_LIVRE`). Convenção igual à de `email_passo_N`, usada pelos anexos
 * de prova dos passos 4 e 6 — o número vai no próprio tipo. */
export function tipoAnexoLivre(passo: number): string {
  return `anexo_passo_${passo}`;
}

/** E-mail de um passo já montado, pronto para revisão ou envio. */
export interface EmailMontado {
  para: string[];
  assunto: string;
  corpo: string;
  /** Nome do(s) arquivo(s) que irão em anexo, separados por vírgula, se houver. */
  anexo: string;
}

/** Dispara o e-mail de cada passo do processo e registra o que saiu.
 *
 * Não bloqueia quem concluiu o passo: o envio roda em segundo plano (`void`), do mesmo jeito
 * que `NotificacaoService` já fazia. Falha de e-mail NÃO desfaz a conclusão do passo — o
 * passo aconteceu de verdade; o que fica registrado é a notificação pendente.
 *
 * O texto vem, em ordem de precedência:
 *   1. o que a pessoa redigiu na tela (passos de `PASSOS_COM_REDACAO_DE_EMAIL`);
 *   2. o modelo editável de slug `passo-N` (Sistema → Ferramentas → Modelos de E-mail);
 *   3. o padrão do código (`EMAILS_POR_PASSO`).
 * Os destinatários seguem a mesma ideia, via `DestinatariosPassoService`. */
@Injectable()
export class PassosNotificacaoService {
  private readonly logger = new Logger('PassosNotificacaoService');

  constructor(
    @InjectRepository(Evento) private readonly eventos: Repository<Evento>,
    @InjectRepository(ProjetoPessoa)
    private readonly pessoas: Repository<ProjetoPessoa>,
    @InjectRepository(ProjetoPasso)
    private readonly passos: Repository<ProjetoPasso>,
    @InjectRepository(Documento)
    private readonly documentos: Repository<Documento>,
    @InjectRepository(EmailPasso)
    private readonly emails: Repository<EmailPasso>,
    @InjectRepository(ModeloEmail)
    private readonly modelos: Repository<ModeloEmail>,
    private readonly destinatarios: DestinatariosPassoService,
    private readonly mailer: MailerService,
    private readonly users: UsersService,
  ) {}

  /** Slug do modelo editável de um passo. Convenção estável: quem criar `passo-7` em
   * Modelos de E-mail passa a mandar naquele passo, sem release. */
  static slugDoPasso(passo: number): string {
    return `passo-${passo}`;
  }

  /** O que vai em anexo no e-mail do passo, na ordem em que a pessoa espera ver:
   *
   *   1. os arquivos que ela mesma anexou na tela (`anexo_passo_N`) — TODOS, porque anexar
   *      dois arquivos e o Painel mandar só um seria pior do que não deixar anexar;
   *   2. o documento gerado que o passo sempre leva (`ANEXO_POR_PASSO`), o mais RECENTE.
   *
   * O arquivo pode ter sumido do disco; nesse caso o próprio envio ignora o anexo em
   * silêncio, mas conferimos aqui para não anunciar "em anexo" um arquivo que não existe
   * mais. */
  private async anexoDoPasso(
    projetoId: number,
    passo: number,
  ): Promise<Anexo[]> {
    const anexos: Anexo[] = [];

    const manuais = await this.documentos.find({
      where: { projetoId, tipo: tipoAnexoLivre(passo) },
      order: { criadoEm: 'ASC' },
    });
    for (const doc of manuais) {
      if (doc.caminho && existsSync(doc.caminho)) {
        anexos.push({
          caminho: doc.caminho,
          nomeArquivo: doc.arquivo || undefined,
        });
      }
    }

    const tipo = ANEXO_POR_PASSO[passo];
    if (tipo) {
      const doc = await this.documentos.findOne({
        where: { projetoId, tipo },
        order: { criadoEm: 'DESC' },
      });
      if (doc?.caminho && existsSync(doc.caminho)) {
        anexos.push({
          caminho: doc.caminho,
          nomeArquivo: doc.arquivo || undefined,
        });
      }
    }

    return anexos;
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

  /** Primeiro e segundo consultor do projeto, para `{{CONSULTOR_A}}`/`{{CONSULTOR_B}}` (e os
   * apelidos `_X`/`_Y`). `Projeto.consultor` guarda a lista separada por vírgula. */
  private static consultoresAB(consultor: string): Record<string, string> {
    const nomes = (consultor ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    return { _consultorA: nomes[0] ?? '', _consultorB: nomes[1] ?? '' };
  }

  /** Nomes designados em um papel do projeto. */
  private async nomesDoPapel(
    projetoId: number,
    papel: PapelProjeto,
  ): Promise<string[]> {
    const vinculos = await this.pessoas.find({ where: { projetoId, papel } });
    return vinculos.map((v) => v.pessoa);
  }

  /** E-mails dos designados em um papel, resolvidos por `usuario_id`.
   *
   * O nome só é usado no vínculo antigo que a migração não conseguiu resolver. Enquanto a
   * resolução era só por nome, o homônimo do consultor designado recebia os e-mails do
   * cliente junto com ele (achado da auditoria dos 21 passos). */
  private async emailsDoPapel(
    projetoId: number,
    papel: PapelProjeto,
  ): Promise<string[]> {
    const vinculos = await this.pessoas.find({ where: { projetoId, papel } });
    if (vinculos.length === 0) return [];
    const ids = new Set(
      vinculos.map((v) => v.usuarioId).filter((id): id is number => id != null),
    );
    const semId = vinculos.filter((v) => v.usuarioId == null).map((v) => v.pessoa);
    const todos = await this.users.listar();
    const porId = todos
      .filter((u) => u.ativo && ids.has(u.id))
      .map((u) => u.email || u.login)
      .filter(Boolean);
    return [...new Set([...porId, ...(await this.emailsDeNomes(semId))])];
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
      case 'gci': {
        // Vínculo com papel 'gci' é a designação de verdade; `Projeto.gci` (texto) é o
        // espelho e só decide em projeto anterior à migração `DesignacaoPorUsuarioId`.
        const porVinculo = await this.emailsDoPapel(projeto.id, 'gci');
        return porVinculo.length > 0
          ? porVinculo
          : this.emailsDeNomes(nomesDoCampo(projeto.gci));
      }
      case 'consultores': {
        // A fonte da verdade são os vínculos por papel; `Projeto.consultor` é só o espelho.
        const porVinculo = await this.emailsDoPapel(projeto.id, 'consultor');
        return porVinculo.length > 0
          ? porVinculo
          : this.emailsDeNomes(nomesDoCampo(projeto.consultor));
      }
      case 'levantadores':
        return this.emailsDoPapel(projeto.id, 'levantador');
      case 'comercial':
        return [projeto.comercialEmail].map((e) => e.trim()).filter(Boolean);
      case 'cliente':
        return [projeto.contatoEmail].map((e) => e.trim()).filter(Boolean);
    }
  }

  /** Valores dos tokens que NÃO são colunas do projeto: o que a pessoa escreveu ao concluir
   * o passo, a data de assinatura que ela marcou e os levantadores designados.
   *
   * A descrição vem do passo ANTERIOR quando o passo atual não tem uma própria — é o caso do
   * passo 5, cuja descrição é justamente o que o e-mail do passo seguinte tem de carregar. */
  private async valoresDoPasso(
    projeto: Projeto,
    passo: number,
    descricaoPendente?: string,
  ): Promise<Record<string, string>> {
    const [registro, anterior, levantadores] = await Promise.all([
      this.passos.findOne({ where: { projetoId: projeto.id, passo } }),
      this.passos.findOne({
        where: { projetoId: projeto.id, passo: passo - 1 },
      }),
      this.nomesDoPapel(projeto.id, 'levantador'),
    ]);
    return {
      // `descricaoPendente` é a descrição que a pessoa ACABOU de digitar e que ainda não foi
      // gravada. Sem ela, a prévia do passo 5 era montada com a descrição VAZIA (o passo
      // ainda não existia no banco), a tela devolvia esse corpo já substituído e o
      // Administrativo recebia "Descrição do Comercial:" em branco — a RN-7 nunca se
      // cumpria pelo caminho da tela (achado de 2026-08-05).
      _descricaoPasso: (
        descricaoPendente ||
        registro?.observacao ||
        anterior?.observacao ||
        ''
      ).trim(),
      _dataMarcada: registro?.dataMarcada || '',
      _levantadores: levantadores.join(', '),
      // `_consultorA`/`_consultorB` não são colunas: saem do split de `consultor`, mesma
      // derivação de `ModeloEmailService`. Entraram aqui junto com `VAR_CAMPO` — sem elas,
      // `{{CONSULTOR_A}}` num modelo de passo sairia literal.
      ...PassosNotificacaoService.consultoresAB(projeto.consultor),
    };
  }

  private aplicarTokens(
    texto: string,
    projeto: Projeto,
    extras: Record<string, string>,
  ): string {
    const valores: Record<string, unknown> = {
      ...(projeto as unknown as Record<string, unknown>),
      ...extras,
    };
    let saida = texto;
    for (const [token, campo] of Object.entries(TOKENS_PASSO)) {
      const valor = valores[campo];
      saida = saida.split(token).join(typeof valor === 'string' ? valor : '');
    }
    return saida;
  }

  /** Monta o e-mail do passo sem enviar — usado pela pré-visualização, pela tela de redação
   * e pelo próprio envio. `null` quando o passo não tem e-mail.
   *
   * `descricaoPendente` é o texto que a pessoa está escrevendo AGORA na tela, antes de
   * concluir: a prévia precisa mostrá-lo já embutido, porque é esse corpo que ela revisa e
   * devolve ao Painel (ver `valoresDoPasso`). */
  async montar(
    projeto: Projeto,
    passo: number,
    descricaoPendente?: string,
  ): Promise<EmailMontado | null> {
    const padrao = EMAIL_POR_PASSO.get(passo);
    if (!padrao) return null;

    // Modelo editável vence o padrão do código, quando existe e está ativo.
    const modelo = await this.modelos.findOne({
      where: { slug: PassosNotificacaoService.slugDoPasso(passo), ativo: true },
    });

    const config = await this.destinatarios.paraOPasso(passo);
    const listas = await Promise.all(
      config.grupos.map((g) => this.resolverDestino(g, projeto)),
    );
    const para = [...new Set([...listas.flat(), ...config.extras])];

    const extras = await this.valoresDoPasso(projeto, passo, descricaoPendente);
    const anexos = await this.anexoDoPasso(projeto.id, passo);

    return {
      para,
      assunto: this.aplicarTokens(
        modelo?.assunto || padrao.assunto,
        projeto,
        extras,
      ),
      corpo: this.aplicarTokens(modelo?.corpo || padrao.corpo, projeto, extras),
      anexo: anexos
        .map((a) => a.nomeArquivo ?? '')
        .filter(Boolean)
        .join(', '),
    };
  }

  /** Envia o e-mail do passo, se houver, e registra o que saiu.
   *
   * `redigido` chega dos passos em que a pessoa revisa o texto na tela antes de mandar; sem
   * ele, vale o que `montar` produziu. */
  async notificarPasso(
    projeto: Projeto,
    def: DefinicaoPasso,
    autor: string,
    redigido?: Partial<EmailMontado>,
  ): Promise<void> {
    try {
      const config = await this.destinatarios.paraOPasso(def.numero);
      if (!config.ativo) return;

      const base = await this.montar(projeto, def.numero);
      if (!base) return;

      const email: EmailMontado = {
        para: redigido?.para?.length ? redigido.para : base.para,
        assunto: redigido?.assunto || base.assunto,
        corpo: redigido?.corpo || base.corpo,
        anexo: base.anexo,
      };

      if (email.para.length === 0) {
        // Sem destinatário não há o que enviar, mas o processo previa um e-mail aqui —
        // fica registrado para alguém resolver (ex.: passo 4 sem o e-mail do Comercial).
        await this.registrarEmail(projeto.id, def, email, autor, {
          status: 'sem_destinatario',
          erro: 'Nenhum destinatário resolvido.',
        });
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

      await this.registrarEmail(projeto.id, def, email, autor, {
        status: ok ? 'enviado' : 'falhou',
        erro: ok ? '' : erro || 'Falha desconhecida no envio.',
      });

      const comAnexo = email.anexo ? ` (anexo: ${email.anexo})` : '';
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

  /** Guarda o e-mail por inteiro, para a consulta por passo. */
  private async registrarEmail(
    projetoId: number,
    def: DefinicaoPasso,
    email: EmailMontado,
    autor: string,
    resultado: {
      status: 'enviado' | 'falhou' | 'sem_destinatario';
      erro: string;
    },
  ): Promise<void> {
    await this.emails.save(
      this.emails.create({
        projetoId,
        passo: def.numero,
        para: email.para.join(', '),
        assunto: email.assunto,
        corpo: email.corpo,
        // `anexo` é varchar(255) e agora pode listar VÁRIOS arquivos: com anexo livre, o
        // nome de dois PDFs longos já estoura a coluna. O registro é informativo (o que
        // vale é o e-mail que saiu), então cortar é preferível a falhar a gravação.
        anexo: email.anexo.slice(0, 255),
        status: resultado.status,
        erro: resultado.erro,
        autor,
      }),
    );
  }

  /** Os e-mails já gerados num projeto — a consulta que qualquer pessoa com acesso ao menu
   * pode fazer. Mais recentes primeiro. */
  async historico(projetoId: number): Promise<EmailPasso[]> {
    return this.emails.find({
      where: { projetoId },
      order: { criadoEm: 'DESC' },
    });
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
