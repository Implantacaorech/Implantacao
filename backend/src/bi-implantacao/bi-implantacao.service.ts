import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { ConsultaBdService } from '../disponibilidade/consulta-bd.service';
import { hojeIso } from '../cronograma/datas.util';
import { textoAparado } from '../common/utils/texto.util';
import {
  AgrupamentoResumo,
  COR_STATUS_AGENDA,
  DiaAgenda,
  LinhaAgenda,
  LinhaExtrato,
  LinhaResumo,
  LinhaRns,
  LinhaVisitaPortal,
  LIMITE_LINHAS,
  LIMITE_LINHAS_EXTRATO,
  MESES_PADRAO,
  NOME_CONSULTA_VISITAS_PORTAL,
  ResumoStatusAgenda,
  SLUG_CONSULTA_VISITAS_PORTAL,
  SQL_AGENDAS,
  SQL_EXTRATO_DESCRICAO,
  SQL_EXTRATO_HORAS,
  SQL_RESUMO_IMPLANTACAO,
  SQL_RNS_VINCULADAS,
  SQL_VISITAS_PORTAL_PADRAO,
  TotaisExtrato,
  TotaisResumo,
  TotaisRns,
  TRECHO_DESCRICAO,
} from './bi-implantacao.constants';

export interface QueryResumo {
  dataIni?: string;
  dataFim?: string;
  grupo?: string[];
  status?: string[];
  tecnico?: string[];
  ativo?: string[];
  tipoCliente?: string[];
  rns?: string[];
}

export interface QueryExtrato {
  dataIni?: string;
  dataFim?: string;
  grupo?: string[];
  tecnico?: string[];
  sigla?: string[];
  cliente?: string[];
  status?: string[];
  rns?: string[];
}

/** Opção do filtro de RNS: o valor é o código, mas o usuário precisa ver de quem é. */
export interface OpcaoRns {
  codigo: string;
  rotulo: string;
}

export interface FiltrosExtrato {
  grupos: string[];
  tecnicos: string[];
  siglas: string[];
  clientes: string[];
  status: string[];
  rns: OpcaoRns[];
}

export interface SelecaoExtrato {
  grupos: string[];
  tecnicos: string[];
  siglas: string[];
  clientes: string[];
  status: string[];
  rns: string[];
}

export interface ResultadoExtrato {
  periodo: { inicio: string; fim: string };
  linhas: LinhaExtrato[];
  totais: TotaisExtrato;
  filtros: FiltrosExtrato;
  selecionados: SelecaoExtrato;
  /** true quando o recorte bateu no teto de linhas — a tela avisa para estreitar o período. */
  truncado: boolean;
  erro: string | null;
}

export interface QueryRns {
  dataIni?: string;
  dataFim?: string;
  grupo?: string[];
  status?: string[];
  tecnico?: string[];
  sigla?: string[];
  tipo?: string[];
  statusImplantacao?: string[];
  rns?: string[];
  /** 'sim' | 'nao' | '' (todas) — a "Validação Cliente" do relatório. */
  validada?: string;
}

export interface FiltrosRns {
  grupos: string[];
  status: string[];
  tecnicos: string[];
  siglas: string[];
  tipos: string[];
  statusImplantacao: string[];
  rns: OpcaoRns[];
}

export interface SelecaoRns {
  grupos: string[];
  status: string[];
  tecnicos: string[];
  siglas: string[];
  tipos: string[];
  statusImplantacao: string[];
  rns: string[];
  validada: string;
}

export interface ContagemRns {
  chave: string;
  quantidade: number;
}

export interface ResultadoRns {
  periodo: { inicio: string; fim: string };
  linhas: LinhaRns[];
  totais: TotaisRns;
  porStatus: ContagemRns[];
  porSigla: ContagemRns[];
  filtros: FiltrosRns;
  selecionados: SelecaoRns;
  erro: string | null;
}

export interface QueryAgendas {
  /** Mês de referência (AAAA-MM). O calendário é mensal, não por período livre. */
  mes?: string;
  grupo?: string[];
  tecnico?: string[];
  status?: string[];
  statusImplantacao?: string[];
  rns?: string[];
}

export interface FiltrosAgendas {
  grupos: string[];
  tecnicos: string[];
  statusImplantacao: string[];
  status: string[];
  rns: OpcaoRns[];
}

export interface SelecaoAgendas {
  grupos: string[];
  tecnicos: string[];
  statusImplantacao: string[];
  status: string[];
  rns: string[];
}

export interface ResultadoAgendas {
  mes: string;
  dias: DiaAgenda[];
  resumo: ResumoStatusAgenda[];
  totalAgendas: number;
  filtros: FiltrosAgendas;
  selecionados: SelecaoAgendas;
  erro: string | null;
}

export interface FiltrosDisponiveis {
  grupos: string[];
  status: string[];
  tecnicos: string[];
  ativos: string[];
  tiposCliente: string[];
  rns: OpcaoRns[];
}

export interface SelecaoResumo {
  grupos: string[];
  status: string[];
  tecnicos: string[];
  ativos: string[];
  tiposCliente: string[];
  rns: string[];
}

export interface ResultadoResumo {
  periodo: { inicio: string; fim: string };
  linhas: LinhaResumo[];
  totais: TotaisResumo;
  porStatus: AgrupamentoResumo[];
  porTecnico: AgrupamentoResumo[];
  filtros: FiltrosDisponiveis;
  selecionados: SelecaoResumo;
  erro: string | null;
}

export interface QueryVisitasPortal {
  dataIni?: string;
  dataFim?: string;
}

export interface ResultadoVisitasPortal {
  periodo: { inicio: string; fim: string };
  /** As visitas do período, já na ordem do SQL (empresa → contato → consultor → data). */
  linhas: LinhaVisitaPortal[];
  total: number;
  limite: number;
  /** A consulta bateu no teto de linhas — há mais visitas no período do que o que veio. */
  truncado: boolean;
  erro: string | null;
}

/** Tela "Resumo de Implantação" — porte da página homônima do BI `BI_clientes.pbix` para
 * dentro do Painel, lendo a MESMA view Oracle que o Power BI lia
 * (`POWERBI.POWERBI_IMPLANTACAO_RESUMO`) pela conexão já configurada em Disponibilidade.
 *
 * O recorte de período vai no SQL (é o que reduz volume); os demais filtros são aplicados em
 * memória, de propósito: assim as listas de opções saem do próprio conjunto do período, sem
 * uma segunda ida ao banco — mesmo desenho já usado em `DashboardsService`. */
@Injectable()
export class BiImplantacaoService implements OnModuleInit {
  private readonly logger = new Logger('BiImplantacaoService');

  constructor(
    private readonly disponibilidade: DisponibilidadeService,
    private readonly consultas: ConsultaBdService,
  ) {}

  /** Semeia a consulta do painel "Visitas do Portal Rech" (idempotente) para o
   * Administrador editar na tela de Consultas BD. Não sobrescreve se já existir —
   * respeita edição manual (mesmo desenho do `RnsService`). */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const existe = await this.consultas.porSlug(SLUG_CONSULTA_VISITAS_PORTAL);
      if (!existe) {
        await this.consultas.salvar(SLUG_CONSULTA_VISITAS_PORTAL, {
          nome: NOME_CONSULTA_VISITAS_PORTAL,
          sql: SQL_VISITAS_PORTAL_PADRAO,
          ordem: 96,
          mostrarGrafico: false,
        });
      }
    } catch (e) {
      this.logger.error(
        'Falha ao semear a consulta de visitas do Portal no Consultas BD',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  private somaMeses(iso: string, n: number): string {
    const [ano, mes, dia] = iso.split('-').map(Number);
    const m = mes - 1 + n;
    const y = ano + Math.floor(m / 12);
    const mm = ((m % 12) + 12) % 12;
    // dia 1..28 é seguro em qualquer mês; acima disso, prende no último dia do mês destino
    const ultimo = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
    const d = Math.min(dia, ultimo);
    return `${y}-${String(mm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  private ehDataIso(v: string | undefined): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test((v ?? '').trim());
  }

  /** Período efetivo: o que a tela mandou, ou os últimos `meses` meses. */
  periodo(
    query: QueryResumo,
    meses = MESES_PADRAO,
  ): { inicio: string; fim: string } {
    const fim = this.ehDataIso(query.dataFim)
      ? (query.dataFim as string).trim()
      : hojeIso();
    const inicio = this.ehDataIso(query.dataIni)
      ? (query.dataIni as string).trim()
      : this.somaMeses(fim, -meses);
    return inicio <= fim ? { inicio, fim } : { inicio: fim, fim: inicio };
  }

  private numero(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private texto(v: unknown): string {
    return textoAparado(v);
  }

  private normalizar(bruta: Record<string, unknown>): LinhaResumo {
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;
    return {
      codigo: this.numero(l.CODIGO),
      cliente:
        l.CLIENTE === null || l.CLIENTE === undefined
          ? null
          : this.numero(l.CLIENTE),
      descricao: this.texto(l.DESCRICAO),
      fantasia: this.texto(l.FANTASIA),
      tecnico: this.texto(l.TECNICO),
      statusRns: this.texto(l.STATUS_RNS),
      tipo:
        l.TIPO === null || l.TIPO === undefined ? null : this.numero(l.TIPO),
      dataContratacao: this.texto(l.DATA_CONTRATACAO).slice(0, 10),
      dataPrevUso: this.texto(l.DATA_PREV_USO).slice(0, 10),
      dataEncerramento: this.texto(l.DATA_ENCERRAMENTO).slice(0, 10),
      horasPrevistas: this.numero(l.HORASPREVISTAS),
      horasRealizadas: this.numero(l.HORASREALIZADAS),
      horasSaldo: this.numero(l.HORASALDO),
      // O relatório original soma as horas "adicionais" às normais — ver a medida
      // Grafico_Horas_HTML (HORASCOBRADAS + HORASCOBRADASADICIONAIS, idem bonificadas).
      horasCobradas:
        this.numero(l.HORASCOBRADAS) + this.numero(l.HORASCOBRADASADICIONAIS),
      horasBonificadas:
        this.numero(l.HORABONIFICADAS) +
        this.numero(l.HORABONIFICADASADICIONAIS),
      grupoEconomico: this.texto(l.GRUPO_ECONOMICO),
      ativoDes: this.texto(l.ATIVODES),
      tipoDes: this.texto(l.TIPODES),
    };
  }

  /** Valores distintos e ordenados de um campo — alimenta as listas de filtro. */
  private distintosDe<T>(linhas: T[], campo: (l: T) => string): string[] {
    const s = new Set<string>();
    for (const l of linhas) {
      const v = campo(l);
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  /** Vazio = "todos" (mesmo default dos slicers do Power BI e do DashboardsService). */
  private passa(selecionados: string[] | undefined, valor: string): boolean {
    const sel = (selecionados ?? []).filter(Boolean);
    return sel.length === 0 || sel.includes(valor);
  }

  /** Linhas que passam por TODOS os filtros, menos o da própria dimensão.
   *
   * É o que faz os filtros funcionarem EM CASCATA: escolher um grupo econômico deve reduzir
   * as opções de RNS, consultor, cliente e módulo. Excluir a própria dimensão é essencial —
   * senão, ao marcar um consultor, a lista de consultores encolheria para só ele e não daria
   * mais para trocar de escolha nem marcar um segundo. */
  private emCascata<T>(
    todas: T[],
    predicados: { dimensao: string; ok: (l: T) => boolean }[],
    dimensaoIgnorada: string,
  ): T[] {
    return todas.filter((l) =>
      predicados.every((p) => p.dimensao === dimensaoIgnorada || p.ok(l)),
    );
  }

  private agrupar(
    linhas: LinhaResumo[],
    chave: (l: LinhaResumo) => string,
    ordenarPorChave = false,
  ): AgrupamentoResumo[] {
    const mapa = new Map<string, AgrupamentoResumo>();
    for (const l of linhas) {
      const k = chave(l) || '(sem informação)';
      const a = mapa.get(k) ?? {
        chave: k,
        quantidade: 0,
        horasPrevistas: 0,
        horasRealizadas: 0,
        horasSaldo: 0,
      };
      a.quantidade += 1;
      a.horasPrevistas += l.horasPrevistas;
      a.horasRealizadas += l.horasRealizadas;
      a.horasSaldo += l.horasSaldo;
      mapa.set(k, a);
    }
    const out = [...mapa.values()].map((a) => ({
      ...a,
      horasPrevistas: this.arredondar(a.horasPrevistas),
      horasRealizadas: this.arredondar(a.horasRealizadas),
      horasSaldo: this.arredondar(a.horasSaldo),
    }));
    return ordenarPorChave
      ? out.sort((x, y) => x.chave.localeCompare(y.chave))
      : out.sort(
          (x, y) =>
            y.horasRealizadas - x.horasRealizadas ||
            y.quantidade - x.quantidade,
        );
  }

  private arredondar(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private totalizar(linhas: LinhaResumo[]): TotaisResumo {
    const t = linhas.reduce(
      (a, l) => {
        a.horasPrevistas += l.horasPrevistas;
        a.horasRealizadas += l.horasRealizadas;
        a.horasSaldo += l.horasSaldo;
        a.horasCobradas += l.horasCobradas;
        a.horasBonificadas += l.horasBonificadas;
        return a;
      },
      {
        quantidade: linhas.length,
        horasPrevistas: 0,
        horasRealizadas: 0,
        horasSaldo: 0,
        horasCobradas: 0,
        horasBonificadas: 0,
      },
    );
    return {
      quantidade: t.quantidade,
      horasPrevistas: this.arredondar(t.horasPrevistas),
      horasRealizadas: this.arredondar(t.horasRealizadas),
      horasSaldo: this.arredondar(t.horasSaldo),
      horasSaldoCalculado: this.arredondar(
        t.horasPrevistas - t.horasRealizadas,
      ),
      horasCobradas: this.arredondar(t.horasCobradas),
      horasBonificadas: this.arredondar(t.horasBonificadas),
      percentualUtilizacao:
        t.horasPrevistas > 0
          ? this.arredondar((t.horasRealizadas / t.horasPrevistas) * 100)
          : null,
    };
  }

  private vazio(
    periodo: { inicio: string; fim: string },
    erro: string | null,
  ): ResultadoResumo {
    return {
      periodo,
      linhas: [],
      totais: this.totalizar([]),
      porStatus: [],
      porTecnico: [],
      filtros: {
        grupos: [],
        status: [],
        tecnicos: [],
        ativos: [],
        tiposCliente: [],
        rns: [],
      },
      selecionados: {
        grupos: [],
        status: [],
        tecnicos: [],
        ativos: [],
        tiposCliente: [],
        rns: [],
      },
      erro,
    };
  }

  async resumo(query: QueryResumo): Promise<ResultadoResumo> {
    const periodo = this.periodo(query);
    if (!this.disponibilidade.configurado()) {
      return this.vazio(
        periodo,
        'Conexão com o SICLA não configurada ou inativa (Ferramentas → Disponibilidade).',
      );
    }

    const r = await this.disponibilidade.executarSql(
      SQL_RESUMO_IMPLANTACAO,
      { data_ini: periodo.inicio, data_fim: periodo.fim },
      undefined,
      LIMITE_LINHAS,
    );
    if (!r.ok) return this.vazio(periodo, r.mensagem);

    const todas = r.linhas.map((l) => this.normalizar(l));

    // Filtros em CASCATA: cada lista de opções considera os DEMAIS filtros já marcados.
    const preds = [
      {
        dimensao: 'grupo',
        ok: (l: LinhaResumo) => this.passa(query.grupo, l.grupoEconomico),
      },
      {
        dimensao: 'status',
        ok: (l: LinhaResumo) => this.passa(query.status, l.statusRns),
      },
      {
        dimensao: 'tecnico',
        ok: (l: LinhaResumo) => this.passa(query.tecnico, l.tecnico),
      },
      {
        dimensao: 'ativo',
        ok: (l: LinhaResumo) => this.passa(query.ativo, l.ativoDes),
      },
      {
        dimensao: 'tipoCliente',
        ok: (l: LinhaResumo) => this.passa(query.tipoCliente, l.tipoDes),
      },
      {
        dimensao: 'rns',
        ok: (l: LinhaResumo) => this.passa(query.rns, String(l.codigo)),
      },
    ];
    const paraDim = (d: string) => this.emCascata(todas, preds, d);

    const filtros: FiltrosDisponiveis = {
      grupos: this.distintosDe(paraDim('grupo'), (l) => l.grupoEconomico),
      status: this.distintosDe(paraDim('status'), (l) => l.statusRns),
      tecnicos: this.distintosDe(paraDim('tecnico'), (l) => l.tecnico),
      ativos: this.distintosDe(paraDim('ativo'), (l) => l.ativoDes),
      tiposCliente: this.distintosDe(paraDim('tipoCliente'), (l) => l.tipoDes),
      rns: this.opcoesRns(
        paraDim('rns').map((l) => ({
          rns: l.codigo,
          fantasia: l.fantasia,
          rnsDescricao: l.descricao,
        })),
      ),
    };

    const linhas = todas.filter((l) => preds.every((p) => p.ok(l)));

    return {
      periodo,
      linhas,
      totais: this.totalizar(linhas),
      porStatus: this.agrupar(linhas, (l) => l.statusRns, true),
      porTecnico: this.agrupar(linhas, (l) => l.tecnico),
      filtros,
      selecionados: {
        grupos: (query.grupo ?? []).filter(Boolean),
        status: (query.status ?? []).filter(Boolean),
        tecnicos: (query.tecnico ?? []).filter(Boolean),
        ativos: (query.ativo ?? []).filter(Boolean),
        tiposCliente: (query.tipoCliente ?? []).filter(Boolean),
        rns: (query.rns ?? []).filter(Boolean),
      },
      erro: null,
    };
  }

  // ── Painel "Visitas do Portal Rech" (Resumo, abaixo do CONTROLE DE HORAS) ────────────

  private normalizarVisita(bruta: Record<string, unknown>): LinhaVisitaPortal {
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;
    return {
      empresa: this.texto(l.EMPRESA),
      cliente:
        l.CODIGO_CLIENTE === null || l.CODIGO_CLIENTE === undefined
          ? null
          : this.numero(l.CODIGO_CLIENTE),
      contato: this.texto(l.CONTATO),
      consultor: this.texto(l.CONSULTOR),
      protocolo:
        l.PROTOCOLO === null || l.PROTOCOLO === undefined
          ? null
          : this.numero(l.PROTOCOLO),
      data: this.texto(l.DATA).slice(0, 10),
      horario: this.texto(l.HORARIO),
      turno: this.texto(l.TURNO),
      aprovado: this.texto(l.APROVADO),
    };
  }

  private vazioVisitas(
    periodo: { inicio: string; fim: string },
    erro: string | null,
  ): ResultadoVisitasPortal {
    return {
      periodo,
      linhas: [],
      total: 0,
      limite: LIMITE_LINHAS,
      truncado: false,
      erro,
    };
  }

  /** Visitas do Portal Rech com o status de aprovação — o SQL vive no **Consultas BD**
   * (slug `bi_visitas_portal`, semeado no boot) e roda na mesma conexão da Disponibilidade;
   * o Administrador o edita pelo painel, sem deploy. */
  async visitasPortal(
    query: QueryVisitasPortal,
  ): Promise<ResultadoVisitasPortal> {
    const periodo = this.periodo(query);
    if (!this.disponibilidade.configurado()) {
      return this.vazioVisitas(
        periodo,
        'Conexão com o SICLA não configurada ou inativa (Ferramentas → Disponibilidade).',
      );
    }

    const c = await this.consultas.porSlug(SLUG_CONSULTA_VISITAS_PORTAL);
    const sql = (c?.sql ?? '').trim() || SQL_VISITAS_PORTAL_PADRAO;

    // Só passa os binds que o SQL vigente referencia: o Administrador pode ter editado a
    // consulta sem :data_ini/:data_fim, e bind sobrando derruba o Oracle com ORA-01036 —
    // o painel apenas perde o recorte de período, que é o esperado.
    const binds: Record<string, string> = {};
    if (/:data_ini\b/.test(sql)) binds.data_ini = periodo.inicio;
    if (/:data_fim\b/.test(sql)) binds.data_fim = periodo.fim;

    const r = await this.disponibilidade.executarSql(
      sql,
      binds,
      undefined,
      LIMITE_LINHAS,
    );
    if (!r.ok) return this.vazioVisitas(periodo, r.mensagem);

    const linhas = r.linhas.map((l) => this.normalizarVisita(l));
    return {
      periodo,
      linhas,
      total: linhas.length,
      limite: LIMITE_LINHAS,
      truncado: linhas.length >= LIMITE_LINHAS,
      erro: null,
    };
  }

  // ── Página "Extrato de Protocolo/Horas" ──────────────────────────────────────────────

  private normalizarExtrato(bruta: Record<string, unknown>): LinhaExtrato {
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;
    const tamanho = this.numero(l.DESCRICAO_TAMANHO);
    return {
      rns: this.numero(l.IMP_COD),
      cliente:
        l.IMP_CLIENTE === null || l.IMP_CLIENTE === undefined
          ? null
          : this.numero(l.IMP_CLIENTE),
      protocolo:
        l.PROTOCOLO === null || l.PROTOCOLO === undefined
          ? null
          : this.numero(l.PROTOCOLO),
      data: this.texto(l.DATA).slice(0, 10),
      hora: this.texto(l.HORA).slice(0, 5),
      sigla: this.texto(l.LIS_SIGLA),
      tecnico: this.texto(l.LIS_TECNICODESCRICAO),
      assunto: this.texto(l.LIS_DESCRICAO),
      sistema: this.texto(l.SISTEMADESCRICAO),
      descricao: this.texto(l.DESCRICAO),
      descricaoTamanho: tamanho,
      descricaoTruncada: tamanho > TRECHO_DESCRICAO,
      // O SICLA grava o consumo como NEGATIVO; o relatório mostra o absoluto.
      horasUtilizadas: Math.abs(this.numero(l.LISHORASUTILIZADAS)),
      saldoAcumulado: this.numero(l.SALDO_ACUMULADO),
      fantasia: this.texto(l.FANTASIA),
      grupoEconomico: this.texto(l.GRUPO_ECONOMICO),
      statusRns: this.texto(l.STATUS_RNS),
      rnsDescricao: this.texto(l.RNS_DESCRICAO),
    };
  }

  /** Opções do filtro de RNS, rotuladas com o cliente para dar contexto ao número.
   * Aceita qualquer linha que saiba dizer seu código, cliente e descrição — serve tanto ao
   * Resumo (`codigo`/`descricao`) quanto ao Extrato (`rns`/`rnsDescricao`). */
  private opcoesRns(
    linhas: { rns: number; fantasia: string; rnsDescricao: string }[],
  ): OpcaoRns[] {
    const mapa = new Map<string, string>();
    for (const l of linhas) {
      if (!l.rns) continue;
      const codigo = String(l.rns);
      if (!mapa.has(codigo)) {
        const nome = l.fantasia || l.rnsDescricao;
        mapa.set(codigo, nome ? `${codigo} — ${nome}` : codigo);
      }
    }
    return [...mapa.entries()]
      .map(([codigo, rotulo]) => ({ codigo, rotulo }))
      .sort((a, b) => Number(b.codigo) - Number(a.codigo));
  }

  private vazioExtrato(
    periodo: { inicio: string; fim: string },
    erro: string | null,
  ): ResultadoExtrato {
    return {
      periodo,
      linhas: [],
      totais: { lancamentos: 0, horasUtilizadas: 0, saldoAtual: null },
      filtros: {
        grupos: [],
        tecnicos: [],
        siglas: [],
        clientes: [],
        status: [],
        rns: [],
      },
      selecionados: {
        grupos: [],
        tecnicos: [],
        siglas: [],
        clientes: [],
        status: [],
        rns: [],
      },
      truncado: false,
      erro,
    };
  }

  async extrato(query: QueryExtrato): Promise<ResultadoExtrato> {
    const periodo = this.periodo(query);
    if (!this.disponibilidade.configurado()) {
      return this.vazioExtrato(
        periodo,
        'Conexão com o SICLA não configurada ou inativa (Ferramentas → Disponibilidade).',
      );
    }

    const r = await this.disponibilidade.executarSql(
      SQL_EXTRATO_HORAS,
      { data_ini: periodo.inicio, data_fim: periodo.fim },
      undefined,
      LIMITE_LINHAS_EXTRATO,
    );
    if (!r.ok) return this.vazioExtrato(periodo, r.mensagem);

    const todas = r.linhas.map((l) => this.normalizarExtrato(l));

    const preds = [
      {
        dimensao: 'grupo',
        ok: (l: LinhaExtrato) => this.passa(query.grupo, l.grupoEconomico),
      },
      {
        dimensao: 'tecnico',
        ok: (l: LinhaExtrato) => this.passa(query.tecnico, l.tecnico),
      },
      {
        dimensao: 'sigla',
        ok: (l: LinhaExtrato) => this.passa(query.sigla, l.sigla),
      },
      {
        dimensao: 'cliente',
        ok: (l: LinhaExtrato) => this.passa(query.cliente, l.fantasia),
      },
      {
        dimensao: 'status',
        ok: (l: LinhaExtrato) => this.passa(query.status, l.statusRns),
      },
      {
        dimensao: 'rns',
        ok: (l: LinhaExtrato) => this.passa(query.rns, String(l.rns)),
      },
    ];
    const paraDim = (d: string) => this.emCascata(todas, preds, d);

    const filtros: FiltrosExtrato = {
      grupos: this.distintosDe(paraDim('grupo'), (l) => l.grupoEconomico),
      tecnicos: this.distintosDe(paraDim('tecnico'), (l) => l.tecnico),
      siglas: this.distintosDe(paraDim('sigla'), (l) => l.sigla),
      clientes: this.distintosDe(paraDim('cliente'), (l) => l.fantasia),
      status: this.distintosDe(paraDim('status'), (l) => l.statusRns),
      rns: this.opcoesRns(paraDim('rns')),
    };

    const linhas = todas.filter((l) => preds.every((p) => p.ok(l)));

    // As linhas vêm ordenadas por DATAHORA desc, então o saldo "de agora" é o da 1ª linha.
    const saldoAtual = linhas.length > 0 ? linhas[0].saldoAcumulado : null;
    return {
      periodo,
      linhas,
      totais: {
        lancamentos: linhas.length,
        horasUtilizadas: this.arredondar(
          linhas.reduce((a, l) => a + l.horasUtilizadas, 0),
        ),
        saldoAtual,
      },
      filtros,
      selecionados: {
        grupos: (query.grupo ?? []).filter(Boolean),
        tecnicos: (query.tecnico ?? []).filter(Boolean),
        siglas: (query.sigla ?? []).filter(Boolean),
        clientes: (query.cliente ?? []).filter(Boolean),
        status: (query.status ?? []).filter(Boolean),
        rns: (query.rns ?? []).filter(Boolean),
      },
      truncado: todas.length >= LIMITE_LINHAS_EXTRATO,
      erro: null,
    };
  }

  // ── Página "RNS" (RNS vinculadas às implantações) ────────────────────────────────────

  private normalizarRns(bruta: Record<string, unknown>): LinhaRns {
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;
    const pedido = this.numero(l.PEDIDO);
    const item = this.numero(l.ITEM);
    return {
      codigo: this.numero(l.CODIGO),
      rns: `${pedido}-${item}`,
      pedido,
      item,
      dataCriacao: this.texto(l.DATA_CRIACAO).slice(0, 10),
      statusRns: this.texto(l.STATUSDES),
      sigla: this.texto(l.SIGLA),
      sistema: this.texto(l.SISDESCRI),
      visaoGeral: this.texto(l.VISAOGERAL),
      versoesGeracao: this.texto(l.VERSOESGERACAO),
      validadaCliente: this.numero(l.VALIDADOCLI) === 1,
      tipo: this.texto(l.TIPODES),
      responsavel: this.texto(l.RESNOME),
      analista: this.texto(l.ANANOME),
      cliente:
        l.CLIENTE === null || l.CLIENTE === undefined
          ? null
          : this.numero(l.CLIENTE),
      fantasia: this.texto(l.FANTASIA),
      rnsImplantacao: this.numero(l.IMP_COD),
      descricaoImplantacao: this.texto(l.IMP_DESCRICAO),
      statusImplantacao: this.texto(l.STATUS_IMPLANTACAO),
      tecnico: this.texto(l.TECNICO),
      grupoEconomico: this.texto(l.GRUPO_ECONOMICO),
    };
  }

  private vazioRns(
    periodo: { inicio: string; fim: string },
    erro: string | null,
  ): ResultadoRns {
    return {
      periodo,
      linhas: [],
      totais: { quantidade: 0, validadas: 0, naoValidadas: 0, implantacoes: 0 },
      porStatus: [],
      porSigla: [],
      filtros: {
        grupos: [],
        status: [],
        tecnicos: [],
        siglas: [],
        tipos: [],
        statusImplantacao: [],
        rns: [],
      },
      selecionados: {
        grupos: [],
        status: [],
        tecnicos: [],
        siglas: [],
        tipos: [],
        statusImplantacao: [],
        rns: [],
        validada: '',
      },
      erro,
    };
  }

  /** Contagem simples por dimensão — os painéis desta tela são de quantidade, não de horas. */
  private contarPor(
    linhas: LinhaRns[],
    chave: (l: LinhaRns) => string,
  ): ContagemRns[] {
    const mapa = new Map<string, number>();
    for (const l of linhas) {
      const k = chave(l) || '(sem informação)';
      mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
    return [...mapa.entries()]
      .map(([chave, quantidade]) => ({ chave, quantidade }))
      .sort(
        (a, b) => b.quantidade - a.quantidade || a.chave.localeCompare(b.chave),
      );
  }

  async rnsVinculadas(query: QueryRns): Promise<ResultadoRns> {
    const periodo = this.periodo(query);
    if (!this.disponibilidade.configurado()) {
      return this.vazioRns(
        periodo,
        'Conexão com o SICLA não configurada ou inativa (Ferramentas → Disponibilidade).',
      );
    }

    const r = await this.disponibilidade.executarSql(
      SQL_RNS_VINCULADAS,
      { data_ini: periodo.inicio, data_fim: periodo.fim },
      undefined,
      LIMITE_LINHAS,
    );
    if (!r.ok) return this.vazioRns(periodo, r.mensagem);

    const todas = r.linhas.map((l) => this.normalizarRns(l));

    // "Validação Cliente" é tri-estado: sem seleção = todas.
    const validada = (query.validada ?? '').trim();
    const preds = [
      {
        dimensao: 'grupo',
        ok: (l: LinhaRns) => this.passa(query.grupo, l.grupoEconomico),
      },
      {
        dimensao: 'status',
        ok: (l: LinhaRns) => this.passa(query.status, l.statusRns),
      },
      {
        dimensao: 'tecnico',
        ok: (l: LinhaRns) => this.passa(query.tecnico, l.tecnico),
      },
      {
        dimensao: 'sigla',
        ok: (l: LinhaRns) => this.passa(query.sigla, l.sigla),
      },
      { dimensao: 'tipo', ok: (l: LinhaRns) => this.passa(query.tipo, l.tipo) },
      {
        dimensao: 'statusImplantacao',
        ok: (l: LinhaRns) =>
          this.passa(query.statusImplantacao, l.statusImplantacao),
      },
      {
        dimensao: 'rns',
        ok: (l: LinhaRns) => this.passa(query.rns, String(l.rnsImplantacao)),
      },
      {
        dimensao: 'validada',
        ok: (l: LinhaRns) =>
          validada === ''
            ? true
            : validada === 'sim'
              ? l.validadaCliente
              : !l.validadaCliente,
      },
    ];
    const paraDim = (d: string) => this.emCascata(todas, preds, d);

    const filtros: FiltrosRns = {
      grupos: this.distintosDe(paraDim('grupo'), (l) => l.grupoEconomico),
      status: this.distintosDe(paraDim('status'), (l) => l.statusRns),
      tecnicos: this.distintosDe(paraDim('tecnico'), (l) => l.tecnico),
      siglas: this.distintosDe(paraDim('sigla'), (l) => l.sigla),
      tipos: this.distintosDe(paraDim('tipo'), (l) => l.tipo),
      statusImplantacao: this.distintosDe(
        paraDim('statusImplantacao'),
        (l) => l.statusImplantacao,
      ),
      rns: this.opcoesRns(
        paraDim('rns').map((l) => ({
          rns: l.rnsImplantacao,
          fantasia: l.fantasia,
          rnsDescricao: l.descricaoImplantacao,
        })),
      ),
    };

    const linhas = todas.filter((l) => preds.every((p) => p.ok(l)));

    return {
      periodo,
      linhas,
      totais: {
        quantidade: linhas.length,
        validadas: linhas.filter((l) => l.validadaCliente).length,
        naoValidadas: linhas.filter((l) => !l.validadaCliente).length,
        implantacoes: new Set(linhas.map((l) => l.rnsImplantacao)).size,
      },
      porStatus: this.contarPor(linhas, (l) => l.statusRns),
      porSigla: this.contarPor(linhas, (l) => l.sigla),
      filtros,
      selecionados: {
        grupos: (query.grupo ?? []).filter(Boolean),
        status: (query.status ?? []).filter(Boolean),
        tecnicos: (query.tecnico ?? []).filter(Boolean),
        siglas: (query.sigla ?? []).filter(Boolean),
        tipos: (query.tipo ?? []).filter(Boolean),
        statusImplantacao: (query.statusImplantacao ?? []).filter(Boolean),
        rns: (query.rns ?? []).filter(Boolean),
        validada,
      },
      erro: null,
    };
  }

  // ── Página "Agendas" (calendário mensal) ─────────────────────────────────────────────

  /** Mês de referência (AAAA-MM) e as fronteiras para o SQL. */
  private mesReferencia(mes?: string): {
    mes: string;
    ini: string;
    fim: string;
  } {
    const m = /^\d{4}-\d{2}$/.test((mes ?? '').trim())
      ? (mes as string).trim()
      : hojeIso().slice(0, 7);
    const [ano, num] = m.split('-').map(Number);
    const ini = `${m}-01`;
    const proximo =
      num === 12
        ? `${ano + 1}-01-01`
        : `${ano}-${String(num + 1).padStart(2, '0')}-01`;
    return { mes: m, ini, fim: proximo };
  }

  private normalizarAgenda(bruta: Record<string, unknown>): LinhaAgenda {
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;

    const statusOriginal = this.texto(l.STATUSDES);
    // Regra do DAX: visita apontada manda no status, seja qual for o STATUSDES.
    // (Na view a coluna é nula ou preenchida — nunca 0, apesar do `VISITA <> 0` do original.)
    const temVisita =
      l.VISITA !== null &&
      l.VISITA !== undefined &&
      this.numero(l.VISITA) !== 0;
    const status = temVisita ? '6-Realizada' : statusOriginal;

    const horaIni = this.texto(l.HORAINI).slice(0, 5);
    const hora = Number(horaIni.slice(0, 2));
    const turno = hora < 12 ? 'Manhã' : hora < 18 ? 'Tarde' : 'Noite';

    return {
      codigo: this.numero(l.CODIGO),
      rnsImplantacao: this.numero(l.RNSIMP),
      dia: this.texto(l.DIA).slice(0, 10),
      horaIni,
      horaFim: this.texto(l.HORAFIM).slice(0, 5),
      status,
      statusOriginal,
      especie: this.numero(l.ESPECIE),
      especieDes: this.texto(l.ESPECIEDES),
      // `PARTICIPANTES` chega como "Fulano,Beltrano" — o relatório tratava a string inteira
      // como se fosse UM técnico; aqui cada nome vira um participante, que é o que permite
      // filtrar por consultor e contar carga por pessoa.
      participantes: this.texto(l.PARTICIPANTES)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      responsavel: this.texto(l.RESPONSAVELDES),
      cliente:
        l.CLIENTE === null || l.CLIENTE === undefined
          ? null
          : this.numero(l.CLIENTE),
      clienteFantasia: this.texto(l.CLIENTEFAN),
      assunto: this.texto(l.ASSUNTO),
      horasDuracao: this.numero(l.HORASDURACAO),
      observacao: this.texto(l.OBSERVACAO),
      turno,
      statusImplantacao: this.texto(l.STATUS_IMPLANTACAO),
      tecnicoImplantacao: this.texto(l.TECNICO),
      descricaoImplantacao: this.texto(l.RNS_DESCRICAO),
      grupoEconomico: this.texto(l.GRUPO_ECONOMICO),
    };
  }

  /** Regra de prioridade do DIA, do DAX: havendo alguma "3-Agendada", o dia mostra SÓ as
   * agendadas; senão, havendo alguma "1-Solicitada", oculta as canceladas; senão, mostra
   * tudo. Serve para o dia não ficar poluído de cancelamentos quando há compromisso firme. */
  private prioridadeDoDia(agendas: LinhaAgenda[]): LinhaAgenda[] {
    const temAgendada = agendas.some((a) => a.status === '3-Agendada');
    if (temAgendada) return agendas.filter((a) => a.status === '3-Agendada');
    const temSolicitada = agendas.some((a) => a.status === '1-Solicitada');
    if (temSolicitada) return agendas.filter((a) => a.status !== '9-Cancelada');
    return agendas;
  }

  /** Ordena por turno e horário — `turno × 10000 + hora × 60 + minuto`, como no DAX. */
  private ordemAgenda(a: LinhaAgenda): number {
    const [h, m] = a.horaIni.split(':').map(Number);
    const hora = Number.isFinite(h) ? h : 0;
    const min = Number.isFinite(m) ? m : 0;
    const turno = hora < 12 ? 0 : hora < 18 ? 1 : 2;
    return turno * 10000 + hora * 60 + min;
  }

  private vazioAgendas(mes: string, erro: string | null): ResultadoAgendas {
    return {
      mes,
      dias: [],
      resumo: [],
      totalAgendas: 0,
      filtros: {
        grupos: [],
        tecnicos: [],
        statusImplantacao: [],
        status: [],
        rns: [],
      },
      selecionados: {
        grupos: [],
        tecnicos: [],
        statusImplantacao: [],
        status: [],
        rns: [],
      },
      erro,
    };
  }

  async agendas(query: QueryAgendas): Promise<ResultadoAgendas> {
    const { mes, ini, fim } = this.mesReferencia(query.mes);
    if (!this.disponibilidade.configurado()) {
      return this.vazioAgendas(
        mes,
        'Conexão com o SICLA não configurada ou inativa (Ferramentas → Disponibilidade).',
      );
    }

    const r = await this.disponibilidade.executarSql(
      SQL_AGENDAS,
      { mes_ini: ini, mes_fim: fim },
      undefined,
      LIMITE_LINHAS,
    );
    if (!r.ok) return this.vazioAgendas(mes, r.mensagem);

    const todas = r.linhas.map((l) => this.normalizarAgenda(l));

    const preds = [
      {
        dimensao: 'grupo',
        ok: (a: LinhaAgenda) => this.passa(query.grupo, a.grupoEconomico),
      },
      {
        dimensao: 'tecnico',
        // Basta UM participante casar — a agenda é de todos eles.
        ok: (a: LinhaAgenda) => {
          const sel = (query.tecnico ?? []).filter(Boolean);
          return (
            sel.length === 0 || a.participantes.some((p) => sel.includes(p))
          );
        },
      },
      {
        dimensao: 'status',
        ok: (a: LinhaAgenda) => this.passa(query.status, a.status),
      },
      {
        dimensao: 'statusImplantacao',
        ok: (a: LinhaAgenda) =>
          this.passa(query.statusImplantacao, a.statusImplantacao),
      },
      {
        dimensao: 'rns',
        ok: (a: LinhaAgenda) => this.passa(query.rns, String(a.rnsImplantacao)),
      },
    ];
    const paraDim = (d: string) => this.emCascata(todas, preds, d);

    const filtros: FiltrosAgendas = {
      grupos: this.distintosDe(paraDim('grupo'), (a) => a.grupoEconomico),
      tecnicos: [
        ...new Set(paraDim('tecnico').flatMap((a) => a.participantes)),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      statusImplantacao: this.distintosDe(
        paraDim('statusImplantacao'),
        (a) => a.statusImplantacao,
      ),
      status: this.distintosDe(paraDim('status'), (a) => a.status),
      rns: this.opcoesRns(
        paraDim('rns').map((a) => ({
          rns: a.rnsImplantacao,
          fantasia: a.clienteFantasia,
          rnsDescricao: a.descricaoImplantacao,
        })),
      ),
    };

    const filtradas = todas.filter((a) => preds.every((p) => p.ok(a)));

    // Monta os dias do mês — inclusive os sem agenda, para a grade não ter buracos.
    const [ano, num] = mes.split('-').map(Number);
    const diasNoMes = new Date(Date.UTC(ano, num, 0)).getUTCDate();
    const porDia = new Map<string, LinhaAgenda[]>();
    for (const a of filtradas) {
      const lista = porDia.get(a.dia) ?? [];
      lista.push(a);
      porDia.set(a.dia, lista);
    }

    const dias: DiaAgenda[] = [];
    for (let d = 1; d <= diasNoMes; d++) {
      const iso = `${mes}-${String(d).padStart(2, '0')}`;
      const doDia = porDia.get(iso) ?? [];
      const visiveis = this.prioridadeDoDia(doDia).sort(
        (x, y) => this.ordemAgenda(x) - this.ordemAgenda(y),
      );
      dias.push({
        dia: iso,
        numero: d,
        diaSemana: new Date(`${iso}T00:00:00Z`).getUTCDay(),
        agendas: visiveis,
        totalNoDia: doDia.length,
      });
    }

    // O resumo conta o que está VISÍVEL no calendário (após a prioridade do dia), senão os
    // cards diriam um número e a grade mostraria outro.
    const visiveis = dias.flatMap((d) => d.agendas);
    const contagem = new Map<string, number>();
    for (const a of visiveis)
      contagem.set(a.status, (contagem.get(a.status) ?? 0) + 1);
    const total = visiveis.length;
    const resumo: ResumoStatusAgenda[] = [...contagem.entries()]
      .map(([status, quantidade]) => ({
        status,
        quantidade,
        percentual:
          total > 0 ? Math.round((quantidade / total) * 1000) / 10 : 0,
        cor: COR_STATUS_AGENDA[status] ?? '#CCCCCC',
      }))
      .sort((a, b) => a.status.localeCompare(b.status));

    return {
      mes,
      dias,
      resumo,
      totalAgendas: total,
      filtros,
      selecionados: {
        grupos: (query.grupo ?? []).filter(Boolean),
        tecnicos: (query.tecnico ?? []).filter(Boolean),
        statusImplantacao: (query.statusImplantacao ?? []).filter(Boolean),
        status: (query.status ?? []).filter(Boolean),
        rns: (query.rns ?? []).filter(Boolean),
      },
      erro: null,
    };
  }

  /** Texto completo da descrição de UM lançamento (o modal do relatório original). Só é
   * buscado quando o usuário abre o item — na listagem vem apenas uma prévia. */
  async descricaoCompleta(
    protocolo: number,
    datahora: string,
  ): Promise<{ descricao: string; tamanho: number; erro: string | null }> {
    if (!this.disponibilidade.configurado()) {
      return {
        descricao: '',
        tamanho: 0,
        erro: 'Conexão com o SICLA não configurada.',
      };
    }
    const r = await this.disponibilidade.executarSql(
      SQL_EXTRATO_DESCRICAO,
      { protocolo, datahora },
      undefined,
      1,
    );
    if (!r.ok) return { descricao: '', tamanho: 0, erro: r.mensagem };
    if (r.linhas.length === 0) {
      return { descricao: '', tamanho: 0, erro: 'Lançamento não encontrado.' };
    }
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r.linhas[0]))
      l[(k || '').toUpperCase()] = v;
    return {
      descricao: this.texto(l.DESCRICAO),
      tamanho: this.numero(l.DESCRICAO_TAMANHO),
      erro: null,
    };
  }
}
