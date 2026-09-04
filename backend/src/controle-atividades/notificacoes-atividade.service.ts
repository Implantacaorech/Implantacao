import { Injectable, Logger } from '@nestjs/common';
import { AtividadeCartao } from '../database/entities/atividade-cartao.entity';
import { AtividadeQuadro } from '../database/entities/atividade-quadro.entity';
import { TipoNotificacaoAtividade } from '../database/entities/atividade-notificacao.entity';
import { MailerService } from '../email/mailer.service';
import { UsersService } from '../users/users.service';
import { NotificacoesRepository } from './repositories/notificacoes.repository';
import { QuadrosRepository } from './repositories/quadros.repository';
import { DetalhesCartaoRepository } from './repositories/detalhes-cartao.repository';

export interface AvisoPendente {
  id: number;
  tipo: TipoNotificacaoAtividade;
  titulo: string;
  texto: string;
  cartaoId: number | null;
  codigoClienteSicla: string;
  criadoEm: Date;
}

/** Avisos do módulo: a caixa que alimenta o pop-up do canto inferior direito **e** o e-mail
 * (decisão 4 do usuário, 2026-09-01).
 *
 * Os dois canais saem do mesmo lugar de propósito: se o aviso in-app e o e-mail fossem
 * disparados de pontos diferentes, um evento novo entraria em um e esqueceria o outro.
 *
 * **Nada aqui derruba a operação.** Notificar é efeito colateral de uma ação que já deu
 * certo (o cartão foi compartilhado, o comentário foi gravado); e-mail fora do ar não pode
 * desfazer isso. Por isso todo envio é `catch`-ado e vira log. */
@Injectable()
export class NotificacoesAtividadeService {
  private readonly logger = new Logger('NotificacoesAtividadeService');

  constructor(
    private readonly notificacoes: NotificacoesRepository,
    private readonly quadros: QuadrosRepository,
    private readonly detalhes: DetalhesCartaoRepository,
    private readonly usuarios: UsersService,
    private readonly mailer: MailerService,
  ) {}

  async pendentes(usuarioId: number): Promise<AvisoPendente[]> {
    const linhas = await this.notificacoes.pendentes(usuarioId);
    return linhas.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      texto: n.texto,
      cartaoId: n.cartaoId,
      codigoClienteSicla: n.codigoClienteSicla,
      criadoEm: n.criadoEm,
    }));
  }

  async marcarLidas(usuarioId: number, ids: number[]): Promise<void> {
    await this.notificacoes.marcarLidas(usuarioId, ids);
  }

  async marcarTodasLidas(usuarioId: number): Promise<void> {
    await this.notificacoes.marcarTodasLidas(usuarioId);
  }

  /** Grava o aviso in-app para cada destinatário e manda o e-mail para os que têm endereço.
   *
   * `exceto` tira o AUTOR da lista: quem fez a ação não precisa ser avisado dela.
   *
   * **`emailPara` separa os dois canais**, e é o que faz valer a regra do usuário
   * (2026-09-03): *o e-mail vai só para quem está vinculado ao cartão; nunca para todos os
   * integrantes da implantação.* Quando informado, o e-mail sai apenas para essa lista — o
   * aviso na TELA continua indo para `usuarioIds`.
   *
   * Os canais são separados porque o custo de errar é diferente. Aviso na tela é passivo:
   * quem abre o Painel vê, e um a mais não incomoda ninguém. E-mail é ativo: chega na caixa
   * de entrada de gente que não pediu, e uma equipe inteira recebendo aviso de cartão alheio
   * aprende a ignorar TODOS os avisos do Painel — inclusive os que importam. */
  async avisar(
    quadro: AtividadeQuadro,
    cartao: AtividadeCartao | null,
    tipo: TipoNotificacaoAtividade,
    titulo: string,
    texto: string,
    usuarioIds: number[],
    exceto?: number,
    emailPara?: number[],
  ): Promise<void> {
    const alvos = [...new Set(usuarioIds)].filter((id) => id && id !== exceto);
    if (!alvos.length) return;

    await this.notificacoes.criarVarias(
      alvos.map((usuarioId) => ({
        usuarioId,
        quadroId: quadro.id,
        cartaoId: cartao?.id ?? null,
        codigoClienteSicla: quadro.codigoClienteSicla,
        tipo,
        titulo,
        texto,
      })),
    );

    // Sem `emailPara`, o e-mail acompanha o aviso da tela — comportamento de quem não precisa
    // do recorte. Com ele, o recorte manda, e uma lista VAZIA significa e-mail nenhum: é o
    // caso do cartão sem ninguém vinculado, e mandar para o quadro inteiro ali seria
    // exatamente o que a regra proíbe.
    const paraEmail = emailPara
      ? [...new Set(emailPara)].filter((id) => id && id !== exceto)
      : alvos;
    await this.porEmail(paraEmail, quadro, titulo, texto);
  }

  /** Avisa por e-mail endereços SOLTOS — os contatos do cliente que ainda não têm conta no
   * Painel e por isso não recebem pop-up. */
  async avisarEnderecos(
    quadro: AtividadeQuadro,
    enderecos: string[],
    titulo: string,
    texto: string,
  ): Promise<void> {
    const limpos = [...new Set(enderecos.map((e) => e.trim()).filter(Boolean))];
    if (!limpos.length) return;
    await this.enviar(limpos, quadro, titulo, texto);
  }

  private async porEmail(
    usuarioIds: number[],
    quadro: AtividadeQuadro,
    titulo: string,
    texto: string,
  ): Promise<void> {
    const enderecos: string[] = [];
    for (const id of usuarioIds) {
      const u = await this.usuarios.buscarPorId(id).catch(() => null);
      if (u?.email) enderecos.push(u.email);
    }
    await this.enviar(enderecos, quadro, titulo, texto);
  }

  private async enviar(
    enderecos: string[],
    quadro: AtividadeQuadro,
    titulo: string,
    texto: string,
  ): Promise<void> {
    if (!enderecos.length) return;
    try {
      const r = await this.mailer.enviar(
        enderecos,
        `[Painel] ${titulo} — ${quadro.nomeCliente}`,
        `${texto}\n\nAbra o Controle de Atividades no Painel de Implantação para responder.`,
      );
      if (!r.ok) this.logger.warn(`E-mail de aviso não saiu: ${r.erro ?? '?'}`);
    } catch (e) {
      // Aviso é efeito colateral: a ação que o gerou já foi gravada e não se desfaz porque o
      // servidor de e-mail está fora.
      this.logger.warn(`Falha ao enviar aviso: ${(e as Error).message}`);
    }
  }

  /** Quem responde pelo quadro (para avisar do que o cliente fez). */
  async responsaveisDo(quadroId: number): Promise<number[]> {
    const v = await this.quadros.responsaveis([quadroId]);
    return v.map((x) => x.usuarioId);
  }

  /** Membros INTERNOS de um cartão que têm conta — os designados pelo cliente na
   * solicitação. */
  async internosDoCartao(cartaoId: number): Promise<number[]> {
    const membros = await this.detalhes.membrosDe([cartaoId]);
    return membros
      .filter((m) => m.tipo === 'interno' && m.usuarioId)
      .map((m) => m.usuarioId as number);
  }

  /** Endereços dos membros do lado CLIENTE — os que recebem o aviso de compartilhamento. */
  async enderecosDoCliente(cartaoId: number): Promise<string[]> {
    const membros = await this.detalhes.membrosDe([cartaoId]);
    return membros
      .filter((m) => m.tipo === 'cliente' && m.email)
      .map((m) => m.email);
  }
}
