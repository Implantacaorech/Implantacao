import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { QuadrosRepository } from './repositories/quadros.repository';
import { ListasRepository } from './repositories/listas.repository';
import { CartoesRepository } from './repositories/cartoes.repository';
import { QuadrosService } from './quadros.service';
import { cartaoVisivel, podeLerQuadro } from './acesso';
import {
  ETIQUETAS,
  MIN_BUSCA,
  TETO_BUSCA,
} from './controle-atividades.constants';

export interface AchadoBusca {
  cartaoId: number;
  titulo: string;
  codigoClienteSicla: string;
  nomeCliente: string;
  lista: string;
  visivelCliente: boolean;
  concluido: boolean;
  /** O quadro é de outro consultor (a tela mostra o selo "consulta"). */
  soConsulta: boolean;
  responsaveis: string[];
}

export interface ResultadoBuscaAtividades {
  termo: string;
  total: number;
  truncado: boolean;
  quadros: number;
  achados: AchadoBusca[];
}

/** Consulta geral de cartões — o campo da barra de cima, varrendo todos os quadros de uma vez.
 *
 * **A busca reusa o MESMO recorte do quadro** (`podeLerQuadro` + `cartaoVisivel`), nunca um
 * filtro próprio. Busca com filtro paralelo é exatamente onde o recorte do cliente acaba
 * esquecido: bastaria um `WHERE` a menos aqui para o bastidor da Rech aparecer numa pesquisa.
 *
 * O casamento é feito em MEMÓRIA, e não em SQL. O volume é o das atividades de uma carteira
 * de implantação (ordem de milhares de linhas), o filtro precisa ignorar acento — coisa que
 * depende de collation no MariaDB e não existe igual no SQLite dos testes — e a alternativa
 * seria um LIKE por coluna que ainda assim não casaria "conversao" com "conversão". */
@Injectable()
export class BuscaService {
  constructor(
    private readonly quadros: QuadrosRepository,
    private readonly listas: ListasRepository,
    private readonly cartoes: CartoesRepository,
    private readonly quadrosSvc: QuadrosService,
  ) {}

  async buscar(
    user: AuthUser,
    termoBruto: string,
    consultorId?: number,
  ): Promise<ResultadoBuscaAtividades> {
    const termo = normalizar(termoBruto ?? '');
    const vazio: ResultadoBuscaAtividades = {
      termo: (termoBruto ?? '').trim(),
      total: 0,
      truncado: false,
      quadros: 0,
      achados: [],
    };
    if (termo.length < MIN_BUSCA) return vazio;

    const ctx = await this.quadrosSvc.contexto(user);
    const todos = await this.quadros.listar();
    let visiveis = todos.filter((q) =>
      podeLerQuadro(ctx, q.codigoClienteSicla),
    );
    if (!visiveis.length) return vazio;

    const ids = visiveis.map((q) => q.id);
    const vinculos = await this.quadros.responsaveis(ids);

    // Filtro por consultor — o mesmo da aba "Demais consultores", aplicado também à busca
    // para os dois caminhos concordarem sobre o que "os quadros do fulano" quer dizer.
    if (consultorId) {
      const doConsultor = new Set(
        vinculos
          .filter((v) => v.usuarioId === consultorId)
          .map((v) => v.quadroId),
      );
      visiveis = visiveis.filter((q) => doConsultor.has(q.id));
      if (!visiveis.length) return vazio;
    }

    const idsFiltrados = visiveis.map((q) => q.id);
    const [listas, cartoes] = await Promise.all([
      this.listas.dosQuadros(idsFiltrados),
      this.cartoes.dosQuadros(idsFiltrados, !ctx.interno),
    ]);
    const listaPorId = new Map(listas.map((l) => [l.id, l]));
    const quadroPorId = new Map(visiveis.map((q) => [q.id, q]));
    const meus = new Set(
      vinculos.filter((v) => v.usuarioId === user.sub).map((v) => v.quadroId),
    );
    const nomeEtiqueta = new Map(
      ETIQUETAS.map((e) => [e.chave, normalizar(e.nome)]),
    );

    const achados: AchadoBusca[] = [];
    for (const c of cartoes) {
      const lista = listaPorId.get(c.listaId);
      const quadro = quadroPorId.get(c.quadroId);
      if (!quadro || !lista) continue;
      if (!cartaoVisivel(ctx, c, lista)) continue;

      const etiquetas = c.etiquetas
        .split(',')
        .filter(Boolean)
        .map((e) => nomeEtiqueta.get(e) ?? '')
        .join(' ');
      const alvo = normalizar(`${c.titulo} ${c.descricao} ${etiquetas}`);
      if (!alvo.includes(termo)) continue;

      achados.push({
        cartaoId: c.id,
        titulo: c.titulo,
        codigoClienteSicla: quadro.codigoClienteSicla,
        nomeCliente: quadro.nomeCliente,
        lista: lista.titulo,
        visivelCliente: c.visivelCliente,
        concluido: Boolean(c.concluidoEm),
        soConsulta: ctx.interno && !meus.has(quadro.id),
        responsaveis: [],
      });
    }

    return {
      termo: (termoBruto ?? '').trim(),
      total: achados.length,
      truncado: achados.length > TETO_BUSCA,
      quadros: new Set(achados.map((a) => a.codigoClienteSicla)).size,
      achados: achados.slice(0, TETO_BUSCA),
    };
  }
}

/** Minúsculas e sem acento — para "conversao" achar "Conversão". */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
