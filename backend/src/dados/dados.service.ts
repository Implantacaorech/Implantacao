import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConsultaBdService } from './consulta-bd.service';
import {
  TAMANHO_PAGINA_MAX,
  TAMANHO_PAGINA_PADRAO,
  VERSAO_CONTRATO,
} from './catalogo/catalogo';
import { CatalogoService } from './catalogo/catalogo.service';
import { ChaveConexao, ConsultaCatalogo } from './catalogo/catalogo.types';
import { validarParametros } from './catalogo/parametros.util';
import { ConexoesService, ResultadoBruto } from './conexoes/conexoes.service';

/** Quem está chamando — entra no log de auditoria de cada execução. */
export interface IdentidadeChamador {
  tipo: 'usuario' | 'cliente_api';
  id: string;
  nome: string;
}

export interface OpcoesExecucao {
  pagina?: number;
  tamanho?: number;
}

export interface PaginacaoResultado {
  pagina: number;
  tamanho: number;
  /** Linhas nesta página. */
  retornadas: number;
  /** Linhas que a consulta trouxe do banco (antes do recorte de página). */
  totalCarregado: number;
  temMais: boolean;
  /** O banco devolveu exatamente o teto — pode haver mais dado do que a consulta vê. */
  truncadoNoLimite: boolean;
}

export interface ResultadoConsulta {
  consulta: string;
  versao: string;
  conexao: ChaveConexao;
  colunas: string[];
  linhas: Record<string, unknown>[];
  paginacao: PaginacaoResultado;
  limiteLinhas: number;
  /** Tempo da execução no banco. `0` quando a resposta saiu do cache. */
  ms: number;
  cache: boolean;
  geradoEm: string;
}

/** Resumo de uma consulta para o consumidor — o catálogo publicado, SEM o SQL. O texto do
 * SQL não sai daqui de propósito: é detalhe de implementação, muda sem aviso e revela o
 * schema de um sistema de terceiro. */
export interface ConsultaPublicada {
  nome: string;
  titulo: string;
  descricao: string;
  conexao: ChaveConexao;
  parametros: ConsultaCatalogo['parametros'];
  limiteLinhas: number;
  cacheSegundos: number;
  desde: string;
}

interface EntradaCache {
  expiraEm: number;
  colunas: string[];
  linhas: Record<string, unknown>[];
  truncado: boolean;
}

export interface MetricaConsulta {
  consulta: string;
  execucoes: number;
  acertosCache: number;
  erros: number;
  msTotal: number;
  msMedio: number;
  ultimaEm: string | null;
}

/** ================================================================================
 *  EXECUTOR DA API DE DADOS — a fronteira única entre o Painel e os bancos externos.
 *
 *  Regra do projeto (2026-08-25): toda e qualquer consulta a banco externo passa por aqui,
 *  identificada por um NOME do catálogo. Não existe endpoint que aceite SQL do consumidor:
 *  o SQL mora no servidor, os parâmetros são tipados e o teto de linhas é da consulta, não
 *  de quem chama.
 *  ================================================================================ */
@Injectable()
export class DadosService {
  private readonly logger = new Logger('DadosService');
  private readonly cache = new Map<string, EntradaCache>();
  private readonly metricas = new Map<string, MetricaConsulta>();

  constructor(
    private readonly conexoes: ConexoesService,
    private readonly consultasSalvas: ConsultaBdService,
    private readonly catalogo: CatalogoService,
  ) {}

  /** Catálogo publicado, opcionalmente recortado pelas consultas que o token autoriza.
   * É assíncrono porque o catálogo EFETIVO mistura as consultas de código com as publicadas
   * pela tela (ver CatalogoService). */
  async listar(consultasDoChamador?: string[]): Promise<ConsultaPublicada[]> {
    const permitido = (c: ConsultaCatalogo): boolean =>
      !consultasDoChamador || consultasDoChamador.includes(c.nome);
    return (await this.catalogo.listar())
      .filter(permitido)
      .map((c) => this.publicar(c));
  }

  async descrever(nome: string): Promise<ConsultaPublicada> {
    return this.publicar(await this.exigirConsulta(nome));
  }

  /** A conexão externa está cadastrada e ativa? Pergunta legítima de quem decide se vale a
   * pena montar uma tela — evita disparar N consultas que já se sabe que vão falhar. Não
   * substitui a checagem do executor: quem consulta não precisa perguntar antes. */
  conexaoConfigurada(chave: ChaveConexao): boolean {
    return this.conexoes.configurada(chave);
  }

  /** A consulta existe no catálogo EFETIVO? Usado pelo guard, antes de decidir autorização.
   * Devolve `undefined` em vez de lançar: quem responde "não existe" é o executor, com a
   * mensagem que aponta o catálogo — barrar no guard esconderia erro de digitação atrás de
   * "sem permissão". */
  async buscar(nome: string): Promise<ConsultaCatalogo | undefined> {
    return this.catalogo.porNome(nome);
  }

  private publicar(c: ConsultaCatalogo): ConsultaPublicada {
    return {
      nome: c.nome,
      titulo: c.titulo,
      descricao: c.descricao,
      conexao: c.conexao,
      parametros: c.parametros,
      limiteLinhas: c.limiteLinhas,
      cacheSegundos: c.cacheSegundos,
      desde: c.desde,
    };
  }

  private async exigirConsulta(nome: string): Promise<ConsultaCatalogo> {
    const c = await this.catalogo.porNome(nome);
    if (!c) {
      throw new NotFoundException(
        `Consulta "${nome}" não existe no catálogo ${VERSAO_CONTRATO}. Veja GET /api/dados/${VERSAO_CONTRATO}/consultas.`,
      );
    }
    return c;
  }

  /** Resolve o TEXTO vigente do SQL. Para consulta editável, o que vale é o que está em
   * Sistema → Consultas BD; o texto embutido no código é só fallback de banco recém-criado
   * (antes do seed). Sem nenhum dos dois, falha com uma mensagem que diz onde resolver. */
  private async sqlVigente(c: ConsultaCatalogo): Promise<string> {
    if (c.origem.tipo === 'fixo') return c.origem.sql;

    if (c.origem.tipo === 'tela') {
      // Sem fallback de propósito: não existe versão "de código" de uma consulta de tela.
      // Se a linha sumiu de Consultas BD, a consulta deixou de existir.
      const salva = await this.consultasSalvas.porSlug(c.origem.slug);
      const texto = (salva?.sql ?? '').trim();
      if (!texto) {
        throw new ServiceUnavailableException(
          `A consulta "${c.nome}" foi criada em Sistema → Consultas BD (slug "${c.origem.slug}") e não foi encontrada lá.`,
        );
      }
      return texto;
    }

    if (c.origem.tipo === 'config_conexao') {
      const texto =
        this.conexoes.sqlDeConfiguracao(c.conexao, c.origem.campo).trim() ||
        c.origem.sqlPadrao.trim();
      if (!texto) {
        throw new ServiceUnavailableException(
          `A consulta "${c.nome}" depende do SELECT gravado em Sistema → Ferramentas → Disponibilidade, que está em branco.`,
        );
      }
      return texto;
    }

    const salva = await this.consultasSalvas.porSlug(c.origem.slug);
    const texto = (salva?.sql ?? '').trim() || c.origem.sqlPadrao.trim();
    if (!texto) {
      throw new ServiceUnavailableException(
        `A consulta "${c.nome}" depende do SQL salvo em Sistema → Consultas BD (slug "${c.origem.slug}"), que não foi encontrado.`,
      );
    }
    return texto;
  }

  /** Chamador padrão das consultas feitas pelas TELAS do Painel (`consultar`). A pessoa por
   * trás da requisição não é repassada por cada módulo — mas a linha de auditoria carrega o
   * correlation-id da requisição (middleware `correlacao`), que amarra esta execução ao log
   * de acesso onde o usuário real está. */
  private static readonly CHAMADOR_TELA: IdentidadeChamador = {
    tipo: 'usuario',
    id: 'painel',
    nome: 'Painel (tela)',
  };

  /** Versão NÃO-LANÇANTE, para os módulos do próprio Painel.
   *
   * Devolve exatamente o shape que os executores já devolviam (`{ok, mensagem, colunas,
   * linhas}`) — é o que torna a migração dos módulos mecânica e, principalmente, o que
   * preserva o comportamento das telas: elas degradam com um aviso no lugar do dado, nunca
   * com um erro HTTP. Quem traduz falha em código de status é o `executar`, usado só pelo
   * controller. */
  async consultar(
    nome: string,
    parametros: Record<string, unknown> = {},
    quem: IdentidadeChamador = DadosService.CHAMADOR_TELA,
  ): Promise<ResultadoBruto> {
    try {
      // `rodar`, NÃO `executar`: o consumidor interno recebe o resultado INTEIRO, já
      // limitado pelo teto da consulta — é o mesmo contrato do `executarSql` que ele usava
      // antes. Passar pela paginação recortaria em 5000 linhas e truncaria em silêncio as
      // consultas cujo teto é maior (extrato de horas, horas aplicadas, visitas do Portal).
      const { entrada } = await this.rodar(nome, parametros, quem);
      return {
        ok: true,
        mensagem: `${entrada.linhas.length} linha(s).`,
        colunas: entrada.colunas,
        linhas: entrada.linhas,
      };
    } catch (e) {
      return {
        ok: false,
        mensagem: this.mensagemDaFalha(e),
        colunas: [],
        linhas: [],
      };
    }
  }

  /** ESCAPE HATCH DO ADMINISTRADOR — roda um SQL que NÃO está no catálogo.
   *
   * Existe para as duas telas em que o próprio Administrador é o autor do SQL: o "Testar"
   * de Sistema → Consultas BD e o motor de Dashboards, que executam o texto salvo em
   * `consultas_bd`. Sem isto, elas precisariam falar com o driver por fora — exatamente o
   * que o ADR-0003 fechou.
   *
   * O nome é deliberadamente incômodo: **não use em módulo de tela**. Consulta de módulo é
   * entrada no catálogo. Quem chama aqui já passou por `@Roles(PERFIS_SISTEMA)`, e a
   * execução entra na mesma trilha de auditoria das demais. */
  async executarSqlDeAdministrador(
    conexao: ChaveConexao,
    sql: string,
    binds: Record<string, string | number | null> = {},
    limite = TAMANHO_PAGINA_MAX,
    quem: IdentidadeChamador = DadosService.CHAMADOR_TELA,
  ): Promise<ResultadoBruto> {
    if (!this.conexoes.configurada(conexao)) {
      return {
        ok: false,
        mensagem: this.conexoes.motivoIndisponivel(conexao),
        colunas: [],
        linhas: [],
      };
    }
    const inicio = Date.now();
    const r = await this.conexoes.executar(conexao, sql, binds, limite);
    this.auditarAvulso(conexao, quem, binds, Date.now() - inicio, r);
    return r;
  }

  /** Trilha de auditoria do escape hatch. Registra a CONEXÃO e os binds, nunca o SQL: o
   * texto é do Administrador e pode ser longo — o que importa auditar é que alguém rodou
   * SQL fora do catálogo, quando e com que resultado. */
  private auditarAvulso(
    conexao: ChaveConexao,
    quem: IdentidadeChamador,
    binds: Record<string, unknown>,
    ms: number,
    r: ResultadoBruto,
  ): void {
    const trilha = {
      evento: 'api-dados.sql-administrador',
      conexao,
      chamador: `${quem.tipo}:${quem.id}`,
      nome: quem.nome,
      parametros: binds,
      linhas: r.linhas.length,
      ms,
      erro: r.ok ? null : r.mensagem,
    };
    if (r.ok) this.logger.log(JSON.stringify(trilha));
    else this.logger.warn(JSON.stringify(trilha));
  }

  /** Extrai a mensagem legível de uma HttpException do Nest — cujo corpo é `string` (uma
   * mensagem) ou `{ message: string | string[] }` (a lista do ValidationPipe/400). */
  private mensagemDaFalha(e: unknown): string {
    if (e instanceof HttpException) {
      const corpo = e.getResponse();
      if (typeof corpo === 'string') return corpo;
      const m = (corpo as { message?: string | string[] }).message;
      if (Array.isArray(m)) return m.join(' ');
      if (typeof m === 'string') return m;
    }
    return e instanceof Error ? e.message : String(e);
  }

  /** NÚCLEO da execução: resolve, valida, consulta (ou serve do cache), audita. Devolve o
   * conjunto INTEIRO de linhas — quem recorta em páginas é só o `executar`, porque só o
   * consumidor HTTP pagina. Manter a paginação fora daqui é o que impede o consumidor
   * interno de ser truncado em silêncio nas 3 consultas cujo teto passa de uma página. */
  private async rodar(
    nome: string,
    parametros: Record<string, unknown> | undefined,
    quem: IdentidadeChamador,
  ): Promise<{
    consulta: ConsultaCatalogo;
    entrada: EntradaCache;
    ms: number;
    cache: boolean;
  }> {
    const consulta = await this.exigirConsulta(nome);
    const base = await this.sqlVigente(consulta);
    const envelopado = consulta.envelopar ? consulta.envelopar(base) : base;

    // `sql` pode voltar REESCRITO: parâmetro `lista_texto` expande `:nome` numa lista de
    // binds. É o texto reescrito que vai ao banco.
    const { ok, erros, binds, sql } = validarParametros(
      consulta,
      parametros,
      envelopado,
    );
    if (!ok) throw new BadRequestException(erros);

    if (!this.conexoes.configurada(consulta.conexao)) {
      throw new ServiceUnavailableException(
        this.conexoes.motivoIndisponivel(consulta.conexao),
      );
    }

    const chaveCache = `${consulta.nome}|${JSON.stringify(binds)}`;
    const agora = Date.now();
    const emCache = this.cache.get(chaveCache);
    if (emCache && emCache.expiraEm > agora) {
      this.contar(consulta.nome, { cache: true });
      return { consulta, entrada: emCache, ms: 0, cache: true };
    }

    const inicio = Date.now();
    const bruto = await this.conexoes.executar(
      consulta.conexao,
      sql,
      binds,
      consulta.limiteLinhas,
    );
    const ms = Date.now() - inicio;

    if (!bruto.ok) {
      this.contar(consulta.nome, { erro: true, ms });
      this.auditar(consulta, quem, binds, ms, bruto.mensagem);
      // 502: o erro é do sistema de ORIGEM (Oracle/MySQL de terceiro), não da requisição —
      // um 500 aqui faria o consumidor culpar a API de Dados e o monitoramento apontar
      // para o lugar errado.
      throw new BadGatewayException(
        `Falha ao consultar ${consulta.conexao}: ${bruto.mensagem}`,
      );
    }

    const entrada: EntradaCache = {
      expiraEm: agora + consulta.cacheSegundos * 1000,
      colunas: bruto.colunas,
      linhas: bruto.linhas,
      truncado: bruto.linhas.length >= consulta.limiteLinhas,
    };
    if (consulta.cacheSegundos > 0) this.cache.set(chaveCache, entrada);

    this.contar(consulta.nome, { ms });
    this.auditar(consulta, quem, binds, ms, null, bruto.linhas.length);
    return { consulta, entrada, ms, cache: false };
  }

  async executar(
    nome: string,
    parametros: Record<string, unknown> | undefined,
    opcoes: OpcoesExecucao,
    quem: IdentidadeChamador,
  ): Promise<ResultadoConsulta> {
    const { consulta, entrada, ms, cache } = await this.rodar(
      nome,
      parametros,
      quem,
    );
    const pagina = Math.max(1, Math.trunc(opcoes.pagina ?? 1));
    const tamanho = Math.min(
      TAMANHO_PAGINA_MAX,
      Math.max(1, Math.trunc(opcoes.tamanho ?? TAMANHO_PAGINA_PADRAO)),
    );
    return this.montar(consulta, entrada, pagina, tamanho, ms, cache);
  }

  /** A paginação é feita em MEMÓRIA, sobre o resultado já limitado por `limiteLinhas`.
   * É consciente: as consultas do SICLA são agregações/janelas de período, não varreduras
   * de tabela — o teto de cada uma foi dimensionado pelo módulo dono para caber num
   * round-trip. Paginação no banco (OFFSET/FETCH) exigiria reescrever cada SELECT e
   * mudaria o custo no Oracle; entra se e quando alguma consulta passar do teto de forma
   * legítima (o campo `truncadoNoLimite` é o sinal de que isso aconteceu). */
  private montar(
    consulta: ConsultaCatalogo,
    entrada: EntradaCache,
    pagina: number,
    tamanho: number,
    ms: number,
    cache: boolean,
  ): ResultadoConsulta {
    const inicio = (pagina - 1) * tamanho;
    const recorte = entrada.linhas.slice(inicio, inicio + tamanho);
    return {
      consulta: consulta.nome,
      versao: VERSAO_CONTRATO,
      conexao: consulta.conexao,
      colunas: entrada.colunas,
      linhas: recorte,
      paginacao: {
        pagina,
        tamanho,
        retornadas: recorte.length,
        totalCarregado: entrada.linhas.length,
        temMais: inicio + recorte.length < entrada.linhas.length,
        truncadoNoLimite: entrada.truncado,
      },
      limiteLinhas: consulta.limiteLinhas,
      ms,
      cache,
      geradoEm: new Date().toISOString(),
    };
  }

  /** Trilha de auditoria de TODA execução. Vai para o log estruturado (que já carrega o
   * correlation-id da requisição), não para uma tabela: o volume é de BI e cresceria sem
   * teto no banco do Painel. Persistir com retenção é fase 2 — ver docs/pendencias.md.
   *
   * Os VALORES dos binds saem no log; os parâmetros do catálogo são período, código e termo
   * de busca — nada sensível. Um parâmetro que venha a carregar dado pessoal precisa ser
   * mascarado aqui antes de entrar. */
  private auditar(
    consulta: ConsultaCatalogo,
    quem: IdentidadeChamador,
    binds: Record<string, unknown>,
    ms: number,
    erro: string | null,
    linhas = 0,
  ): void {
    const trilha = {
      evento: 'api-dados.execucao',
      consulta: consulta.nome,
      conexao: consulta.conexao,
      chamador: `${quem.tipo}:${quem.id}`,
      nome: quem.nome,
      parametros: binds,
      linhas,
      ms,
      erro,
    };
    if (erro) this.logger.warn(JSON.stringify(trilha));
    else this.logger.log(JSON.stringify(trilha));
  }

  private contar(
    nome: string,
    evento: { cache?: boolean; erro?: boolean; ms?: number },
  ): void {
    const m = this.metricas.get(nome) ?? {
      consulta: nome,
      execucoes: 0,
      acertosCache: 0,
      erros: 0,
      msTotal: 0,
      msMedio: 0,
      ultimaEm: null,
    };
    m.execucoes += 1;
    if (evento.cache) m.acertosCache += 1;
    if (evento.erro) m.erros += 1;
    m.msTotal += evento.ms ?? 0;
    const comBanco = m.execucoes - m.acertosCache;
    m.msMedio = comBanco > 0 ? Math.round(m.msTotal / comBanco) : 0;
    m.ultimaEm = new Date().toISOString();
    this.metricas.set(nome, m);
  }

  /** Uso por consulta desde o último boot — alimenta a tela de operação e responde
   * "quem está consumindo o quê" antes de mexer numa consulta do catálogo. */
  listarMetricas(): MetricaConsulta[] {
    return [...this.metricas.values()].sort(
      (a, b) => b.execucoes - a.execucoes,
    );
  }

  /** Descarta o cache — usado quando o Administrador edita o SQL de uma consulta salva
   * (senão o resultado antigo sobreviveria até o TTL). */
  limparCache(): number {
    const n = this.cache.size;
    this.cache.clear();
    return n;
  }
}
