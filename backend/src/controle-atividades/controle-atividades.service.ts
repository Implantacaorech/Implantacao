import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ListasRepository } from './repositories/listas.repository';
import { CartoesRepository } from './repositories/cartoes.repository';
import { DetalhesCartaoRepository } from './repositories/detalhes-cartao.repository';
import { QuadrosRepository } from './repositories/quadros.repository';
import { QuadrosService } from './quadros.service';
import {
  cartaoVisivel,
  listaVisivel,
  podeCriarCartao,
  podeEditarQuadro,
  podeInteragirCartao,
} from './acesso';
import { ETIQUETAS } from './controle-atividades.constants';

/** Fachada de LEITURA do módulo: monta o quadro inteiro numa resposta só.
 *
 * Uma resposta e não seis (listas, cartões, membros, checklist, anexos, comentários) porque
 * a tela precisa de todas ao mesmo tempo para desenhar o quadro — seis chamadas dariam seis
 * estados de carregamento e um quadro que aparece aos pedaços. */
@Injectable()
export class ControleAtividadesService {
  constructor(
    private readonly quadros: QuadrosRepository,
    private readonly listas: ListasRepository,
    private readonly cartoes: CartoesRepository,
    private readonly detalhes: DetalhesCartaoRepository,
    private readonly usuarios: UsersService,
    private readonly quadrosSvc: QuadrosService,
  ) {}

  etiquetas() {
    return ETIQUETAS;
  }

  /** Consultores do Painel — para escolher membro interno e responsável. */
  async consultores() {
    const todos = await this.usuarios.listar();
    return todos
      .filter((u) => u.ativo && u.perfil !== 'Cliente')
      .map((u) => ({ usuarioId: u.id, nome: u.nome, perfil: u.perfil }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async quadroCompleto(user: AuthUser, codigoCliente: string) {
    const { quadro, ctx } = await this.quadrosSvc.exigirLegivel(
      user,
      codigoCliente,
    );

    const [listasTodas, cartoesTodos, vinculos, usuarios] = await Promise.all([
      this.listas.doQuadro(quadro.id),
      this.cartoes.doQuadro(quadro.id, !ctx.interno),
      this.quadros.responsaveis([quadro.id]),
      this.usuarios.listar(),
    ]);
    const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));
    const listaPorId = new Map(listasTodas.map((l) => [l.id, l]));

    const listas = listasTodas.filter((l) => listaVisivel(ctx, l));
    const cartoes = cartoesTodos.filter((c) =>
      cartaoVisivel(ctx, c, listaPorId.get(c.listaId)),
    );
    const ids = cartoes.map((c) => c.id);

    const [membros, checklist, anexos, comentarios] = await Promise.all([
      this.detalhes.membrosDe(ids),
      this.detalhes.checklistDe(ids),
      this.detalhes.anexosDe(ids),
      this.detalhes.comentariosDe(ids),
    ]);
    const agrupar = <T extends { cartaoId: number }>(itens: T[]) => {
      const m = new Map<number, T[]>();
      for (const i of itens) {
        const lista = m.get(i.cartaoId) ?? [];
        lista.push(i);
        m.set(i.cartaoId, lista);
      }
      return m;
    };
    const porCartao = {
      membros: agrupar(membros),
      checklist: agrupar(checklist),
      anexos: agrupar(anexos),
      comentarios: agrupar(comentarios),
    };

    // O que o CLIENTE não está vendo — a tela mostra o número para o consultor entender o
    // que o outro lado enxerga, e para o próprio cliente saber que há bastidor (sem saber
    // o quê). Contado do conjunto COMPLETO, que só o interno recebe.
    const listasInternas = listasTodas.filter((l) => !l.visivelCliente);
    const idsInternas = new Set(listasInternas.map((l) => l.id));
    const ocultos = ctx.interno
      ? {
          cartoesInternos: cartoesTodos.filter(
            (c) => !c.visivelCliente && !idsInternas.has(c.listaId),
          ).length,
          colunasInternas: listasInternas.length,
          cartoesEmColunasInternas: cartoesTodos.filter((c) =>
            idsInternas.has(c.listaId),
          ).length,
        }
      : null;

    return {
      quadro: {
        id: quadro.id,
        codigoClienteSicla: quadro.codigoClienteSicla,
        nomeCliente: quadro.nomeCliente,
        projetoId: quadro.projetoId,
        responsaveis: vinculos
          .map((v) => ({
            usuarioId: v.usuarioId,
            nome: nomePorId.get(v.usuarioId) ?? `Usuário ${v.usuarioId}`,
            principal: v.principal,
          }))
          .sort((a, b) => Number(b.principal) - Number(a.principal)),
      },
      // Os três decidem o que a TELA habilita. A autorização de verdade é sempre revalidada
      // no backend a cada rota — isto é para a interface não oferecer o que vai dar 403.
      podeEditar: podeEditarQuadro(ctx),
      podeInteragir: podeInteragirCartao(ctx),
      podeCriarCartao: podeCriarCartao(ctx),
      interno: ctx.interno,
      souResponsavel: ctx.responsavel,
      listas: listas.map((l) => ({
        id: l.id,
        titulo: l.titulo,
        ordem: l.ordem,
        visivelCliente: l.visivelCliente,
      })),
      cartoes: cartoes.map((c) => ({
        id: c.id,
        listaId: c.listaId,
        titulo: c.titulo,
        descricao: c.descricao,
        ordem: c.ordem,
        visivelCliente: c.visivelCliente,
        origem: c.origem,
        etiquetas: c.etiquetas.split(',').filter(Boolean),
        prazo: c.prazo,
        concluido: Boolean(c.concluidoEm),
        criadoPorNome: c.criadoPorNome,
        membros: (porCartao.membros.get(c.id) ?? []).map((m) => ({
          id: m.id,
          tipo: m.tipo,
          usuarioId: m.usuarioId,
          nome: m.nome,
          email: m.email,
          cargo: m.cargo,
        })),
        checklist: (porCartao.checklist.get(c.id) ?? []).map((i) => ({
          id: i.id,
          texto: i.texto,
          feito: i.feito,
          feitoPor: i.feitoPor,
        })),
        anexos: (porCartao.anexos.get(c.id) ?? []).map((a) => ({
          id: a.id,
          tipo: a.tipo,
          nome: a.nome,
          url: a.url,
          mime: a.mime,
          tamanho: a.tamanho,
          enviadoPor: a.enviadoPor,
        })),
        comentarios: (porCartao.comentarios.get(c.id) ?? []).map((m) => ({
          id: m.id,
          autorNome: m.autorNome,
          autorTipo: m.autorTipo,
          texto: m.texto,
          criadoEm: m.criadoEm,
        })),
      })),
      ocultos,
    };
  }
}
