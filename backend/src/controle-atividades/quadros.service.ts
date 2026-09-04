import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AtividadeQuadro } from '../database/entities/atividade-quadro.entity';
import { UsersService } from '../users/users.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { EscopoClienteService } from '../permissoes/escopo-cliente.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { QuadrosRepository } from './repositories/quadros.repository';
import { ListasRepository } from './repositories/listas.repository';
import { DesignadosRepository } from './repositories/designados.repository';
import { CartoesRepository } from './repositories/cartoes.repository';
import { ContextoAcesso, podeEditarQuadro, podeLerQuadro } from './acesso';
import {
  COLUNAS_PADRAO,
  MENU_CONTROLE_ATIVIDADES,
} from './controle-atividades.constants';
import { PASSO_ORDEM } from './ordem.util';

export interface ResponsavelResumo {
  usuarioId: number;
  nome: string;
  principal: boolean;
}

export interface QuadroResumo {
  id: number;
  codigoClienteSicla: string;
  nomeCliente: string;
  projetoId: number | null;
  responsaveis: ResponsavelResumo[];
  /** Cartões em aberto (não concluídos) internos e compartilhados — os contadores do rail. */
  abertosInternos: number;
  abertosCompartilhados: number;
  meu: boolean;
}

export interface ListaDeQuadros {
  meus: QuadroResumo[];
  demais: QuadroResumo[];
  /** Consultores que respondem por algum quadro de "demais" — alimenta o FILTRO DE CONSULTOR
   * da aba, pedido em 2026-09-01. Vem do backend (e não é derivado na tela) para a tela não
   * ter de conhecer a regra de quem é responsável. */
  consultores: { usuarioId: number; nome: string }[];
}

/** Quadros, responsáveis e o contexto de acesso do usuário — a base de todo o módulo.
 *
 * É aqui que mora a resposta para "de quem é este quadro", que o resto usa para decidir
 * entre escrita e consulta. */
@Injectable()
export class QuadrosService {
  constructor(
    private readonly quadros: QuadrosRepository,
    private readonly listas: ListasRepository,
    private readonly cartoes: CartoesRepository,
    private readonly usuarios: UsersService,
    private readonly permissoes: PermissoesService,
    private readonly escopo: EscopoClienteService,
    private readonly designados: DesignadosRepository,
  ) {}

  /** Contexto de acesso do usuário, opcionalmente já resolvido para um quadro.
   *
   * O escopo vem do BANCO a cada requisição (via `EscopoClienteService`), nunca do token:
   * revogar o vínculo de um cliente precisa valer na hora, não no próximo refresh. */
  async contexto(user: AuthUser, quadroId?: number): Promise<ContextoAcesso> {
    const escopo = await this.escopo.escopoDe({
      sub: user.sub,
      perfil: user.perfil,
      perfis: user.perfis,
    });
    const interno = escopo.interno;
    const responsavel =
      interno && quadroId
        ? await this.quadros.ehResponsavel(quadroId, user.sub)
        : false;
    return {
      interno,
      codigosCliente: escopo.interno ? [] : escopo.codigos,
      responsavel,
      podeAlterar:
        this.permissoes.nivelEfetivo(
          { sub: user.sub, perfil: user.perfil, perfis: user.perfis },
          MENU_CONTROLE_ATIVIDADES,
        ) === 'alteracao',
    };
  }

  /** Quadro pelo código do cliente, já conferindo se este usuário pode LÊ-LO.
   *
   * 404 (e não 403) quando o usuário-cliente pede um quadro de outro cliente: dizer
   * "proibido" confirmaria que aquele cliente tem quadro aqui. */
  async exigirLegivel(
    user: AuthUser,
    codigo: string,
  ): Promise<{ quadro: AtividadeQuadro; ctx: ContextoAcesso }> {
    const quadro = await this.quadros.porCodigo(codigo);
    if (!quadro) throw new NotFoundException('Quadro não encontrado.');
    const ctx = await this.contexto(user, quadro.id);
    if (!podeLerQuadro(ctx, quadro.codigoClienteSicla)) {
      throw new NotFoundException('Quadro não encontrado.');
    }
    return { quadro, ctx };
  }

  /** Quadro pelo id, sem conferir acesso — para quem já conferiu pelo código. */
  async quadroPorId(id: number): Promise<AtividadeQuadro | null> {
    return this.quadros.porId(id);
  }

  /** Igual à anterior, mas exigindo poder EDITAR a estrutura (responsável interno). */
  async exigirEditavel(
    user: AuthUser,
    codigo: string,
  ): Promise<{ quadro: AtividadeQuadro; ctx: ContextoAcesso }> {
    const { quadro, ctx } = await this.exigirLegivel(user, codigo);
    if (!podeEditarQuadro(ctx)) {
      throw new ForbiddenException(
        'Somente consulta: você não é responsável por este quadro.',
      );
    }
    return { quadro, ctx };
  }

  /** O rail da esquerda: meus quadros, os dos demais e a lista de consultores para filtrar.
   *
   * O usuário-cliente recebe só o próprio quadro em `meus` (ele não tem "demais"), o que
   * deixa a tela igual para os dois papéis sem um segundo endpoint. */
  async listar(user: AuthUser): Promise<ListaDeQuadros> {
    const ctx = await this.contexto(user);
    const todos = await this.quadros.listar();
    const visiveis = todos.filter((q) =>
      podeLerQuadro(ctx, q.codigoClienteSicla),
    );
    const ids = visiveis.map((q) => q.id);

    const [vinculos, cartoes, usuarios] = await Promise.all([
      this.quadros.responsaveis(ids),
      this.cartoes.dosQuadros(ids, !ctx.interno),
      this.usuarios.listar(),
    ]);
    const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));

    // Colunas internas ficam de fora da contagem do cliente pelo mesmo motivo de ficarem
    // fora do quadro: a coluna de bastidor não existe para ele.
    const listasInternas = new Set(
      (await this.listas.dosQuadros(ids))
        .filter((l) => !l.visivelCliente)
        .map((l) => l.id),
    );

    const resumos: QuadroResumo[] = visiveis.map((q) => {
      const resp = vinculos
        .filter((v) => v.quadroId === q.id)
        .map((v) => ({
          usuarioId: v.usuarioId,
          nome: nomePorId.get(v.usuarioId) ?? `Usuário ${v.usuarioId}`,
          principal: v.principal,
        }))
        .sort((a, b) => Number(b.principal) - Number(a.principal));
      const doQuadro = cartoes.filter(
        (c) =>
          c.quadroId === q.id &&
          !c.concluidoEm &&
          (ctx.interno || !listasInternas.has(c.listaId)),
      );
      return {
        id: q.id,
        codigoClienteSicla: q.codigoClienteSicla,
        nomeCliente: q.nomeCliente,
        projetoId: q.projetoId,
        responsaveis: resp,
        abertosInternos: ctx.interno
          ? doQuadro.filter((c) => !c.visivelCliente).length
          : 0,
        abertosCompartilhados: doQuadro.filter((c) => c.visivelCliente).length,
        meu: ctx.interno ? resp.some((r) => r.usuarioId === user.sub) : true,
      };
    });

    const meus = resumos.filter((r) => r.meu);
    const demais = resumos.filter((r) => !r.meu);

    // Filtro de consultor da aba "Demais consultores": só quem de fato responde por um
    // quadro que está NAQUELA aba — oferecer um nome que não filtra nada é ruído.
    const consultores = new Map<number, string>();
    for (const q of demais) {
      for (const r of q.responsaveis) consultores.set(r.usuarioId, r.nome);
    }

    return {
      meus,
      demais,
      consultores: [...consultores.entries()]
        .map(([usuarioId, nome]) => ({ usuarioId, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    };
  }

  /** Projetos a partir dos quais ESTE usuário pode abrir um quadro.
   *
   * Regra do usuário (2026-09-01): quem abre o quadro de um cliente é quem está designado a
   * atendê-lo — GCI ou consultor —, e esse vínculo já existe no cadastro de etapas
   * (`projeto_pessoas`). Então a tela não pede um cliente qualquer do SICLA: ela oferece os
   * projetos em que a pessoa está designada, e o quadro nasce amarrado a um deles. */
  async projetosDisponiveis(user: AuthUser) {
    const ctx = await this.contexto(user);
    if (!ctx.interno) return [];
    const projetos = await this.designados.projetosDe(user.sub, user.nome);
    const jaComQuadro = new Set(
      (await this.quadros.listar()).map((q) => q.projetoId).filter(Boolean),
    );
    return projetos.map((p) => ({
      projetoId: p.id,
      cliente: p.cliente,
      etapa: p.etapa,
      situacao: p.situacao,
      jaTemQuadro: jaComQuadro.has(p.id),
    }));
  }

  /** Abre o quadro de um cliente, a partir de um PROJETO em que o usuário está designado.
   *
   * Os responsáveis são semeados da designação do projeto (consultores + GCI), e não só de
   * quem clicou: é o que faz o quadro nascer na aba "Meus clientes" de toda a equipe que
   * atende aquele cliente, sem ninguém precisar cadastrar nada.
   *
   * Idempotente por cliente: pedir de novo devolve o quadro existente em vez de duplicar — o
   * índice único em `codigo_cliente_sicla` garante isso mesmo em corrida. */
  async abrir(
    user: AuthUser,
    codigo: string,
    nomeCliente: string,
    projetoId?: number | null,
  ): Promise<AtividadeQuadro> {
    const ctx = await this.contexto(user);
    if (!ctx.interno || !ctx.podeAlterar) {
      throw new ForbiddenException('Somente a equipe da Rech abre quadros.');
    }
    const ja = await this.quadros.porCodigo(codigo);
    if (ja) {
      // Quadro que já existe não vira "meu" só por eu ter pedido de novo: quem entra como
      // responsável é quem está designado ao projeto dele.
      await this.semearResponsaveis(ja, user.sub);
      return ja;
    }

    if (!projetoId) {
      throw new BadRequestException(
        'Escolha o projeto do cliente — é a designação dele que define quem responde pelo quadro.',
      );
    }
    const projeto = await this.designados.projetoPorId(projetoId);
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');
    const podeAbrir = await this.estaDesignado(projeto.id, user);
    if (!podeAbrir) {
      throw new ForbiddenException(
        'Só quem está designado a atender este cliente pode abrir o quadro dele.',
      );
    }

    const quadro = await this.quadros.criar({
      codigoClienteSicla: codigo,
      nomeCliente: nomeCliente || projeto.cliente,
      projetoId: projeto.id,
      criadoPorUsuarioId: user.sub,
    });
    await this.quadros.incluirResponsavel(quadro.id, user.sub, true);
    await this.semearResponsaveis(quadro, user.sub);
    await this.listas.criarVarias(
      COLUNAS_PADRAO.map((c, i) => ({
        quadroId: quadro.id,
        titulo: c.titulo,
        visivelCliente: c.visivelCliente,
        ordem: (i + 1) * PASSO_ORDEM,
      })),
    );
    return quadro;
  }

  /** O usuário está designado a este projeto?
   *
   * Confere por identidade (`projeto_pessoas.usuario_id`) e, para os vínculos antigos cujo
   * `usuario_id` é nulo, recua para o NOME — mesmo recuo do módulo de passos. */
  private async estaDesignado(
    projetoId: number,
    user: AuthUser,
  ): Promise<boolean> {
    const pessoas = await this.designados.doProjeto(projetoId);
    if (pessoas.some((p) => p.usuarioId === user.sub)) return true;
    if (pessoas.some((p) => !p.usuarioId && p.pessoa === user.nome))
      return true;
    const projeto = await this.designados.projetoPorId(projetoId);
    return Boolean(
      projeto &&
      (projeto.consultor
        .split(',')
        .map((n) => n.trim())
        .includes(user.nome) ||
        projeto.gci
          .split(',')
          .map((n) => n.trim())
          .includes(user.nome)),
    );
  }

  /** Traz para o quadro os designados do projeto (consultores e GCI).
   *
   * Só ACRESCENTA: quem foi incluído à mão continua, e quem saiu da designação do projeto
   * não é removido automaticamente — tirar acesso de alguém que está no meio de um trabalho
   * é decisão de gente, não efeito colateral de uma sincronização. */
  async semearResponsaveis(
    quadro: AtividadeQuadro,
    incluirTambem?: number,
  ): Promise<number> {
    const ids = new Set<number>();
    if (incluirTambem) ids.add(incluirTambem);
    if (quadro.projetoId) {
      const pessoas = await this.designados.doProjeto(quadro.projetoId);
      for (const p of pessoas) {
        if (p.usuarioId && p.papel !== 'levantador') ids.add(p.usuarioId);
      }
    }
    let n = 0;
    for (const id of ids) {
      await this.quadros.incluirResponsavel(quadro.id, id);
      n += 1;
    }
    return n;
  }

  /** Repuxa a designação do projeto para o quadro — para quando alguém entra na equipe
   * depois de o quadro já existir. */
  async sincronizarResponsaveis(
    user: AuthUser,
    codigo: string,
  ): Promise<number> {
    const { quadro } = await this.exigirEditavel(user, codigo);
    return this.semearResponsaveis(quadro);
  }

  async incluirResponsavel(
    user: AuthUser,
    codigo: string,
    usuarioId: number,
  ): Promise<void> {
    const { quadro } = await this.exigirEditavel(user, codigo);
    // Confere que o usuário existe (e é interno) antes de vinculá-lo: responsável fantasma
    // deixaria o quadro sem dono editável.
    const alvo = await this.usuarios.buscarPorId(usuarioId);
    if (alvo.perfil === 'Cliente') {
      throw new ForbiddenException(
        'Um usuário-cliente não pode ser responsável por um quadro.',
      );
    }
    await this.quadros.incluirResponsavel(quadro.id, usuarioId);
  }

  /** Remove um responsável — nunca o último.
   *
   * Um quadro sem responsável fica em consulta para TODA a Rech e ninguém consegue
   * devolvê-lo, porque incluir responsável exige ser responsável. */
  async removerResponsavel(
    user: AuthUser,
    codigo: string,
    usuarioId: number,
  ): Promise<void> {
    const { quadro } = await this.exigirEditavel(user, codigo);
    const quantos = await this.quadros.contarResponsaveis(quadro.id);
    if (quantos <= 1) {
      throw new ForbiddenException(
        'O quadro precisa de ao menos um responsável — inclua outro antes de sair.',
      );
    }
    await this.quadros.removerResponsavel(quadro.id, usuarioId);
  }
}
