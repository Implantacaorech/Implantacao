import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AtividadeCartao } from '../database/entities/atividade-cartao.entity';
import { AtividadeLista } from '../database/entities/atividade-lista.entity';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CartoesRepository } from './repositories/cartoes.repository';
import { ListasRepository } from './repositories/listas.repository';
import { QuadrosRepository } from './repositories/quadros.repository';
import { DetalhesCartaoRepository } from './repositories/detalhes-cartao.repository';
import { EventosAtividadeRepository } from './repositories/eventos-atividade.repository';
import { UsersService } from '../users/users.service';
import { QuadrosService } from './quadros.service';
import {
  ContextoAcesso,
  cartaoVisivel,
  nasceCompartilhado,
  podeCriarCartao,
  podeDesignarMembro,
  podeEditarCartao,
  podeEditarQuadro,
  podeInteragirCartao,
  podeMoverPara,
} from './acesso';
import { NotificacoesAtividadeService } from './notificacoes-atividade.service';
import {
  COLUNA_CONCLUIDO,
  ETIQUETA_CHAVES,
} from './controle-atividades.constants';
import {
  PASSO_ORDEM,
  ordemEntre,
  precisaRenumerar,
  renumerar,
  sequenciaCom,
} from './ordem.util';

/** Cartão já resolvido com o contexto de quem pediu — o par que quase toda operação precisa. */
interface CartaoComContexto {
  cartao: AtividadeCartao;
  lista: AtividadeLista;
  ctx: ContextoAcesso;
}

const semAcento = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Regras dos cartões: criar, editar, mover, compartilhar, checklist, membros e conversa. */
@Injectable()
export class CartoesService {
  constructor(
    private readonly cartoes: CartoesRepository,
    private readonly listas: ListasRepository,
    private readonly quadros: QuadrosRepository,
    private readonly detalhes: DetalhesCartaoRepository,
    private readonly eventos: EventosAtividadeRepository,
    private readonly quadrosSvc: QuadrosService,
    private readonly avisos: NotificacoesAtividadeService,
    private readonly usuarios: UsersService,
  ) {}

  /** Carrega o cartão conferindo que este usuário pode VÊ-LO.
   *
   * 404 em vez de 403 quando não pode: para o usuário-cliente, um cartão interno não deve
   * nem confirmar que existe. */
  async exigirCartao(
    user: AuthUser,
    cartaoId: number,
  ): Promise<CartaoComContexto> {
    const cartao = await this.cartoes.porId(cartaoId);
    if (!cartao) throw new NotFoundException('Cartão não encontrado.');
    const quadro = await this.quadros.porId(cartao.quadroId);
    if (!quadro) throw new NotFoundException('Cartão não encontrado.');
    const lista = await this.listas.porId(cartao.listaId);
    if (!lista) throw new NotFoundException('Cartão não encontrado.');

    const ctx = await this.quadrosSvc.contexto(user, quadro.id);
    const alcanca = ctx.interno
      ? true
      : ctx.codigosCliente.includes(quadro.codigoClienteSicla);
    if (!alcanca || !cartaoVisivel(ctx, cartao, lista)) {
      throw new NotFoundException('Cartão não encontrado.');
    }
    return { cartao, lista, ctx };
  }

  /** Como a anterior, exigindo poder INTERAGIR (responsável interno ou usuário-cliente). */
  private async exigirInteragivel(
    user: AuthUser,
    cartaoId: number,
  ): Promise<CartaoComContexto> {
    const alvo = await this.exigirCartao(user, cartaoId);
    if (!podeInteragirCartao(alvo.ctx)) {
      throw new ForbiddenException(
        'Somente consulta: você não é responsável por este quadro.',
      );
    }
    return alvo;
  }

  /** Como a anterior, exigindo poder EDITAR a estrutura (só responsável interno). */
  private async exigirEditavel(
    user: AuthUser,
    cartaoId: number,
  ): Promise<CartaoComContexto> {
    const alvo = await this.exigirCartao(user, cartaoId);
    if (!podeEditarQuadro(alvo.ctx)) {
      throw new ForbiddenException(
        'Somente consulta: você não é responsável por este quadro.',
      );
    }
    return alvo;
  }

  /** Para editar o CONTEÚDO do cartão (título, descrição, prazo, etiquetas).
   *
   * Mais permissivo que `exigirEditavel` num ponto só, e de propósito: o usuário-cliente
   * edita o cartão que ELE abriu. É o que faltava para "abrir solicitação" significar alguma
   * coisa — antes ele criava com um título e não tinha onde dizer do que se tratava. */
  private async exigirConteudoEditavel(
    user: AuthUser,
    cartaoId: number,
  ): Promise<CartaoComContexto> {
    const alvo = await this.exigirCartao(user, cartaoId);
    if (!podeEditarCartao(alvo.ctx, alvo.cartao)) {
      throw new ForbiddenException(
        alvo.ctx.interno
          ? 'Somente consulta: você não é responsável por este quadro.'
          : 'Você só pode editar as solicitações que abriu.',
      );
    }
    return alvo;
  }

  private etiquetasValidas(entrada: string[] | undefined): string {
    const limpas = (entrada ?? []).filter((e) => ETIQUETA_CHAVES.includes(e));
    return [...new Set(limpas)].join(',');
  }

  // ------------------------------------------------------------------ cartões

  /** Cria um cartão.
   *
   * Criado pela Rech, **nasce interno** — compartilhar é ato separado e explícito. Criado
   * pelo CLIENTE, nasce compartilhado e com `origem = 'cliente'`: é uma **solicitação** para
   * a Rech, e nascer interna a esconderia de quem acabou de abri-la.
   *
   * O cliente só cria em coluna compartilhada — senão a solicitação cairia dentro do
   * bastidor da Rech e ele nunca mais a veria. */
  async criar(
    user: AuthUser,
    dados: {
      listaId: number;
      titulo: string;
      descricao?: string;
      prazo?: string;
      etiquetas?: string[];
      designadoUsuarioId?: number | null;
    },
  ): Promise<AtividadeCartao> {
    const lista = await this.listas.porId(dados.listaId);
    if (!lista) throw new NotFoundException('Coluna não encontrada.');
    const quadro = await this.quadros.porId(lista.quadroId);
    if (!quadro) throw new NotFoundException('Coluna não encontrada.');
    const ctx = await this.quadrosSvc.contexto(user, quadro.id);
    if (!podeCriarCartao(ctx)) {
      throw new ForbiddenException(
        'Somente consulta: você não é responsável por este quadro.',
      );
    }
    if (!ctx.interno) {
      const alcanca = ctx.codigosCliente.includes(quadro.codigoClienteSicla);
      if (!alcanca) throw new NotFoundException('Coluna não encontrada.');
      if (!lista.visivelCliente) {
        throw new ForbiddenException('Esta coluna não aceita o cartão.');
      }
    }

    const compartilhado = nasceCompartilhado(ctx);
    const irmaos = await this.cartoes.daLista(lista.id);
    const ultimo = irmaos.length ? irmaos[irmaos.length - 1].ordem : null;
    const cartao = await this.cartoes.criar({
      listaId: lista.id,
      quadroId: quadro.id,
      titulo: dados.titulo.trim(),
      descricao: (dados.descricao ?? '').trim(),
      prazo: (dados.prazo ?? '').trim(),
      etiquetas: this.etiquetasValidas(dados.etiquetas),
      ordem: ordemEntre(ultimo, null),
      visivelCliente: compartilhado,
      origem: ctx.interno ? 'consultor' : 'cliente',
      criadoPorUsuarioId: user.sub,
      criadoPorNome: user.nome,
    });
    await this.eventos.registrar({
      quadroId: quadro.id,
      cartaoId: cartao.id,
      tipo: 'cartao.criado',
      detalhe: JSON.stringify({ titulo: cartao.titulo, origem: cartao.origem }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });

    // Solicitação do cliente: designa o consultor escolhido e avisa a Rech na hora — este é
    // o caminho em que o aviso importa de verdade, porque ninguém da Rech está olhando o
    // quadro esperando o cliente digitar.
    if (!ctx.interno) {
      const designados: number[] = [];
      if (dados.designadoUsuarioId) {
        const alvo = await this.usuarios
          .buscarPorId(dados.designadoUsuarioId)
          .catch(() => null);
        if (alvo && alvo.perfil !== 'Cliente') {
          await this.detalhes.incluirMembro({
            cartaoId: cartao.id,
            tipo: 'interno',
            usuarioId: alvo.id,
            nome: alvo.nome,
          });
          designados.push(alvo.id);
        }
      }
      const responsaveis = await this.avisos.responsaveisDo(quadro.id);
      // Regra do usuário (2026-09-03): o E-MAIL de atividade nova sai só para quem está
      // VINCULADO AO CARTÃO — nunca para todos os integrantes da implantação. Quem responde
      // pelo quadro continua recebendo o aviso na TELA, para a solicitação não se perder
      // quando o cliente não designa ninguém; o que não acontece mais é a equipe inteira
      // receber e-mail de um cartão que não é dela.
      await this.avisos.avisar(
        quadro,
        cartao,
        'solicitacao',
        'Nova solicitação do cliente',
        `${user.nome} abriu "${cartao.titulo}" no quadro de ${quadro.nomeCliente}.`,
        [...responsaveis, ...designados],
        user.sub,
        designados,
      );
    }
    return cartao;
  }

  async editar(
    user: AuthUser,
    cartaoId: number,
    dados: {
      titulo?: string;
      descricao?: string;
      prazo?: string;
      etiquetas?: string[];
      projetoId?: number | null;
    },
  ): Promise<AtividadeCartao> {
    const { cartao, ctx } = await this.exigirConteudoEditavel(user, cartaoId);
    // `projetoId` é vínculo administrativo do quadro, não conteúdo: continua só do
    // responsável interno, mesmo agora que o cliente edita a própria solicitação.
    if (!ctx.interno && dados.projetoId !== undefined) {
      throw new ForbiddenException(
        'O vínculo com o projeto é da equipe da Rech.',
      );
    }
    if (dados.titulo !== undefined) cartao.titulo = dados.titulo.trim();
    if (dados.descricao !== undefined)
      cartao.descricao = dados.descricao.trim();
    if (dados.prazo !== undefined) cartao.prazo = dados.prazo.trim();
    if (dados.etiquetas !== undefined) {
      cartao.etiquetas = this.etiquetasValidas(dados.etiquetas);
    }
    if (dados.projetoId !== undefined) cartao.projetoId = dados.projetoId;
    return this.cartoes.salvar(cartao);
  }

  /** Move o cartão para uma coluna e uma posição.
   *
   * A posição nova sai do PONTO MÉDIO entre os vizinhos (`ordem.util.ts`), então o caso
   * normal grava UMA linha. Só quando os vizinhos ficam próximos demais a coluna inteira é
   * renumerada — e aí sim se paga o custo, uma vez a cada muitas centenas de movimentos. */
  async mover(
    user: AuthUser,
    cartaoId: number,
    destinoListaId: number,
    indice: number,
  ): Promise<AtividadeCartao> {
    const { cartao, ctx } = await this.exigirInteragivel(user, cartaoId);
    const destino = await this.listas.porId(destinoListaId);
    if (!destino || destino.quadroId !== cartao.quadroId) {
      throw new BadRequestException('Coluna de destino inválida.');
    }
    // O cliente não empurra o próprio cartão para dentro do bastidor da Rech.
    if (!podeMoverPara(ctx, destino)) {
      throw new ForbiddenException('Esta coluna não aceita o cartão.');
    }

    const antes = cartao.listaId;
    const irmaos = (await this.cartoes.daLista(destinoListaId)).filter(
      (c) => c.id !== cartao.id,
    );
    const pos = Math.max(0, Math.min(indice, irmaos.length));
    const anterior = pos > 0 ? irmaos[pos - 1].ordem : null;
    const proximo = pos < irmaos.length ? irmaos[pos].ordem : null;

    cartao.listaId = destinoListaId;
    cartao.ordem = ordemEntre(anterior, proximo);
    this.aplicarConclusao(cartao, destino);
    await this.cartoes.salvar(cartao);

    if (precisaRenumerar(anterior, proximo)) {
      await this.renumerarColuna(destinoListaId, cartao.id, pos);
    }
    if (antes !== destinoListaId) {
      await this.eventos.registrar({
        quadroId: cartao.quadroId,
        cartaoId: cartao.id,
        tipo: cartao.concluidoEm ? 'cartao.concluido' : 'cartao.movido',
        detalhe: JSON.stringify({ de: antes, para: destinoListaId }),
        autorUsuarioId: user.sub,
        autorNome: user.nome,
      });
    }
    return cartao;
  }

  /** Chegar na coluna "Concluído" conclui o cartão; sair de lá o reabre.
   *
   * A comparação ignora acento e caixa para um rename cosmético da coluna ("concluido") não
   * quebrar o comportamento em silêncio. */
  private aplicarConclusao(
    cartao: AtividadeCartao,
    destino: AtividadeLista,
  ): void {
    const concluida = semAcento(destino.titulo) === semAcento(COLUNA_CONCLUIDO);
    if (concluida && !cartao.concluidoEm) cartao.concluidoEm = new Date();
    if (!concluida && cartao.concluidoEm) cartao.concluidoEm = null;
  }

  private async renumerarColuna(
    listaId: number,
    idMovido: number,
    indice: number,
  ): Promise<void> {
    const atuais = await this.cartoes.daLista(listaId);
    const sequencia = sequenciaCom(atuais, idMovido, indice);
    const ordens = renumerar(sequencia.length);
    const porId = new Map(atuais.map((c) => [c.id, c]));
    const paraSalvar: AtividadeCartao[] = [];
    sequencia.forEach((id, i) => {
      const c = porId.get(id);
      if (c && c.ordem !== ordens[i]) {
        c.ordem = ordens[i];
        paraSalvar.push(c);
      }
    });
    await this.cartoes.salvarVarios(paraSalvar);
  }

  /** Compartilha (ou recolhe) o cartão. Só responsável interno — e sempre com evento. */
  async definirVisibilidade(
    user: AuthUser,
    cartaoId: number,
    visivelCliente: boolean,
  ): Promise<AtividadeCartao> {
    const { cartao } = await this.exigirEditavel(user, cartaoId);
    if (cartao.visivelCliente === visivelCliente) return cartao;
    cartao.visivelCliente = visivelCliente;
    await this.cartoes.salvar(cartao);
    await this.eventos.registrar({
      quadroId: cartao.quadroId,
      cartaoId: cartao.id,
      tipo: visivelCliente ? 'cartao.compartilhado' : 'cartao.recolhido',
      detalhe: JSON.stringify({ titulo: cartao.titulo }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });

    // Só o compartilhamento avisa. Recolher é silencioso de propósito: mandar "este cartão
    // não é mais seu" chamaria atenção justamente para o que se quis tirar de vista.
    if (visivelCliente) {
      const quadro = await this.quadros.porId(cartao.quadroId);
      if (quadro) {
        const enderecos = await this.avisos.enderecosDoCliente(cartao.id);
        await this.avisos.avisarEnderecos(
          quadro,
          enderecos,
          'Nova atividade para você',
          `A Rech compartilhou "${cartao.titulo}" com ${quadro.nomeCliente}.`,
        );
      }
    }
    return cartao;
  }

  async arquivar(user: AuthUser, cartaoId: number): Promise<void> {
    const { cartao } = await this.exigirEditavel(user, cartaoId);
    cartao.arquivado = true;
    await this.cartoes.salvar(cartao);
    await this.eventos.registrar({
      quadroId: cartao.quadroId,
      cartaoId: cartao.id,
      tipo: 'cartao.arquivado',
      detalhe: JSON.stringify({ titulo: cartao.titulo }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });
  }

  // ------------------------------------------------------------------ membros

  async incluirMembro(
    user: AuthUser,
    cartaoId: number,
    dados: {
      tipo: 'interno' | 'cliente';
      usuarioId?: number | null;
      nome: string;
      email?: string;
      cargo?: string;
    },
  ) {
    const { cartao, ctx } = await this.exigirCartao(user, cartaoId);
    // O cliente designa APENAS consultor da Rech; o interno precisa ser responsável.
    if (!podeDesignarMembro(ctx, dados.tipo)) {
      throw new ForbiddenException(
        ctx.interno
          ? 'Somente consulta: você não é responsável por este quadro.'
          : 'Você pode designar apenas um consultor da Rech.',
      );
    }
    const membro = await this.detalhes.incluirMembro({
      cartaoId: cartao.id,
      tipo: dados.tipo,
      usuarioId: dados.usuarioId ?? null,
      nome: dados.nome.trim(),
      email: (dados.email ?? '').trim(),
      cargo: (dados.cargo ?? '').trim(),
    });
    await this.eventos.registrar({
      quadroId: cartao.quadroId,
      cartaoId: cartao.id,
      tipo: 'membro.incluido',
      detalhe: JSON.stringify({ nome: membro.nome, tipo: membro.tipo }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });
    return membro;
  }

  async removerMembro(
    user: AuthUser,
    cartaoId: number,
    membroId: number,
  ): Promise<void> {
    const { cartao, ctx } = await this.exigirCartao(user, cartaoId);
    const membro = await this.detalhes.membroPorId(membroId);
    if (!membro || membro.cartaoId !== cartao.id) {
      throw new NotFoundException('Membro não encontrado.');
    }
    // O cliente corrige a designação da PRÓPRIA solicitação (escolheu o consultor errado);
    // fora disso, mexer em membro é do responsável.
    const clientePodeCorrigir =
      !ctx.interno && cartao.origem === 'cliente' && membro.tipo === 'interno';
    if (!podeDesignarMembro(ctx, membro.tipo) && !clientePodeCorrigir) {
      throw new ForbiddenException(
        'Somente consulta: você não é responsável por este quadro.',
      );
    }
    await this.detalhes.removerMembro(membroId);
    await this.eventos.registrar({
      quadroId: cartao.quadroId,
      cartaoId: cartao.id,
      tipo: 'membro.removido',
      detalhe: JSON.stringify({ nome: membro.nome }),
      autorUsuarioId: user.sub,
      autorNome: user.nome,
    });
  }

  // ---------------------------------------------------------------- checklist

  async incluirItem(user: AuthUser, cartaoId: number, texto: string) {
    const { cartao } = await this.exigirEditavel(user, cartaoId);
    const atuais = await this.detalhes.checklistDe([cartao.id]);
    return this.detalhes.incluirItem({
      cartaoId: cartao.id,
      texto: texto.trim(),
      ordem: (atuais.length + 1) * PASSO_ORDEM,
    });
  }

  /** Marca/desmarca um item. Interagir basta — é o que o cliente faz no dia a dia, e
   * registrar QUEM marcou é justamente o que dá valor ao checklist compartilhado. */
  async marcarItem(
    user: AuthUser,
    cartaoId: number,
    itemId: number,
    feito: boolean,
  ) {
    const { cartao } = await this.exigirInteragivel(user, cartaoId);
    const item = await this.detalhes.itemPorId(itemId);
    if (!item || item.cartaoId !== cartao.id) {
      throw new NotFoundException('Item não encontrado.');
    }
    item.feito = feito;
    item.feitoPor = feito ? user.nome : '';
    item.feitoEm = feito ? new Date() : null;
    return this.detalhes.salvarItem(item);
  }

  async removerItem(
    user: AuthUser,
    cartaoId: number,
    itemId: number,
  ): Promise<void> {
    const { cartao } = await this.exigirEditavel(user, cartaoId);
    const item = await this.detalhes.itemPorId(itemId);
    if (!item || item.cartaoId !== cartao.id) {
      throw new NotFoundException('Item não encontrado.');
    }
    await this.detalhes.removerItem(itemId);
  }

  // -------------------------------------------------------------- comentários

  async comentar(user: AuthUser, cartaoId: number, texto: string) {
    const { cartao, ctx } = await this.exigirInteragivel(user, cartaoId);
    const limpo = texto.trim();
    if (!limpo) throw new BadRequestException('Escreva algo antes de enviar.');
    const comentario = await this.detalhes.incluirComentario({
      cartaoId: cartao.id,
      autorUsuarioId: user.sub,
      autorNome: user.nome,
      // Gravado agora, e não derivado na leitura: se o cadastro do autor mudar depois, o
      // histórico não pode trocar de lado da mesa.
      autorTipo: ctx.interno ? 'interno' : 'cliente',
      texto: limpo,
    });

    // Avisa o OUTRO lado da mesa. Comentário do cliente vira pop-up para a Rech; comentário
    // da Rech vira e-mail para os contatos do cartão.
    const quadro = await this.quadros.porId(cartao.quadroId);
    if (quadro) {
      const trecho = limpo.length > 140 ? `${limpo.slice(0, 140)}…` : limpo;
      if (ctx.interno) {
        const enderecos = await this.avisos.enderecosDoCliente(cartao.id);
        await this.avisos.avisarEnderecos(
          quadro,
          enderecos,
          `Comentário em "${cartao.titulo}"`,
          `${user.nome} (Rech): ${trecho}`,
        );
      } else {
        const [responsaveis, internos] = await Promise.all([
          this.avisos.responsaveisDo(quadro.id),
          this.avisos.internosDoCartao(cartao.id),
        ]);
        // Mesmo recorte da criação, pela mesma razão: e-mail só para quem está vinculado ao
        // cartão. Um comentário do cliente num cartão de outro consultor não tem por que
        // chegar à caixa de entrada da equipe inteira — na tela chega, e basta.
        await this.avisos.avisar(
          quadro,
          cartao,
          'comentario',
          `Comentário em "${cartao.titulo}"`,
          `${user.nome} (${quadro.nomeCliente}): ${trecho}`,
          [...responsaveis, ...internos],
          user.sub,
          internos,
        );
      }
    }
    return comentario;
  }
}
