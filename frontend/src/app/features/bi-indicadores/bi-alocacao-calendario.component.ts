import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BiIndicadoresAbasComponent } from './bi-indicadores-abas.component';
import { BiAgendaAlocacaoService } from '../../core/services/bi-agenda-alocacao.service';
import {
  DiaAlocacaoBi,
  LinhaAlocacaoBi,
  ResultadoCalendarioAlocacaoBi,
} from '../../core/models/bi-agenda-alocacao.model';
import { opcoesVisiveis } from '../bi-implantacao/bi-filtros.util';
import { mensagemErroBi } from '../bi-implantacao/bi-erro.util';
import { BiIndicadoresStore } from './bi-indicadores.store';

const NOMES_MES = [
  '', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Inicial do dia da semana (domingo = 0), usada na régua do mapa de calor. */
const LETRA_SEMANA = ['d', 's', 't', 'q', 'q', 's', 's'];

/** Fronteira manhã/tarde. Um compromisso entra no turno em que COMEÇA — inclusive os que
 * atravessam o dia inteiro (ex.: 07:45–17:45 cai na manhã), como no BI de origem. */
const FIM_DA_MANHA = '12:00';

/** Faixas de criticidade pela DURAÇÃO do compromisso (minutos) — quanto mais longo, mais o
 * turno do técnico fica comprometido. */
const CRITICIDADE: { ate: number; rotulo: string; cor: string }[] = [
  { ate: 60, rotulo: 'NORMAL', cor: '#22c55e' },
  { ate: 120, rotulo: 'MÉDIO', cor: '#f0b429' },
  { ate: 240, rotulo: 'ALTO', cor: '#f97316' },
  { ate: Infinity, rotulo: 'CRÍTICO', cor: '#e11d48' },
];

/** Quanto da cor do status entra no quadrinho do turno, por faixa de carga (0 = livre). */
const MISTURA_CARGA = [0, 32, 62, 100];

export type NomeTurno = 'manha' | 'tarde';

/** Um quadrinho do mapa de calor: um turno de um técnico num dia. */
export interface TurnoAlocacaoBi {
  tecnico: string;
  dia: string;
  turno: NomeTurno;
  rotulo: string;
  compromissos: LinhaAlocacaoBi[];
  minutos: number;
  /** 0 = livre · 1 = até 2h · 2 = até 4h · 3 = acima de 4h. */
  carga: number;
  fundo: string;
  dica: string;
}

export interface DiaTecnicoBi {
  dia: string;
  numero: number;
  letra: string;
  manha: TurnoAlocacaoBi;
  tarde: TurnoAlocacaoBi;
}

export interface TecnicoAlocacaoBi {
  nome: string;
  inicial: string;
  horas: number;
  compromissos: number;
  turnosOcupados: number;
  turnosUteis: number;
  utilizacao: number;
  dias: DiaTecnicoBi[];
}

/** Cor da borda por status — mesmo vocabulário/cores do calendário do outro BI
 * (`bi-agendas.component.ts`), sem 8-Postergada/9-Cancelada: esta origem nunca guarda esses
 * dois códigos. */
const COR_BORDA: Record<string, string> = {
  '1-Solicitada': '#e6c200',
  '3-Agendada': '#00b300',
  '6-Realizada': '#ffaa00',
  '7-Não realizada': '#b8860b',
};

/** Calendário de "Alocação de Agendas" — compromissos dos técnicos (Manutenção OU
 * Implantação), porte da página homônima do `BI_Interno.pbix`. Ao contrário do calendário do
 * BI Implantação Clientes SIGER, aqui NÃO há filtro fixo de espécie: a inspeção do relatório
 * não encontrou restrição de página/relatório, só slicers livres (ver bi-agenda-alocacao
 * .constants.ts no backend). */
@Component({
  selector: 'app-bi-alocacao-calendario',
  standalone: true,
  imports: [FormsModule, BiIndicadoresAbasComponent],
  templateUrl: './bi-alocacao-calendario.component.html',
  styleUrls: [
    '../bi-implantacao/bi-comum.css',
    '../bi-implantacao/bi-agendas.component.css',
    './bi-alocacao-calendario.component.css',
  ],
})
export class BiAlocacaoCalendarioComponent {
  private readonly service = inject(BiAgendaAlocacaoService);
  private readonly store = inject(BiIndicadoresStore);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoCalendarioAlocacaoBi | null>(null);
  readonly filtrosAbertos = this.store.filtrosAbertos;
  readonly buscaOpcoes = this.store.buscaOpcoes;
  readonly busca = this.store.busca;

  readonly gruposSel = this.store.grupo;
  readonly tecnicosSel = this.store.responsavel;
  readonly tipoSuporteSel = this.store.tipoSuporte;
  /** Status do COMPROMISSO — vocabulário próprio desta tela, não se mistura com posição/tipo
   * de implantação das outras páginas de BI Implantação. */
  readonly statusSel = signal<string[]>([]);

  readonly diaAberto = signal<string | null>(null);

  /** `tecnico` = mapa de calor por técnico (padrão, é a leitura do dia a dia da equipe) ·
   * `calendario` = a grade mensal única, útil para enxergar o mês inteiro de uma vez. */
  readonly visao = signal<'tecnico' | 'calendario'>('tecnico');

  /** Quadrinho aberto no mapa de calor — alimenta o painel "Agendas do Técnico". */
  readonly turnoAberto = signal<{ tecnico: string; dia: string; turno: NomeTurno } | null>(
    null,
  );

  get mes(): string { return this.store.mesAlocacao(); }
  set mes(v: string) { this.store.mesAlocacao.set(v); }

  readonly filtros = computed(() => this.resultado()?.filtros ?? null);

  readonly qtdFiltrosAtivos = computed(
    () =>
      this.gruposSel().length +
      this.tecnicosSel().length +
      this.tipoSuporteSel().length +
      this.statusSel().length +
      (this.busca().trim() ? 1 : 0),
  );

  readonly dias = computed<DiaAlocacaoBi[]>(() => {
    const todos = this.resultado()?.dias ?? [];
    const q = this.busca().trim().toLowerCase();
    if (!q) return todos;
    return todos.map((d) => ({
      ...d,
      compromissos: d.compromissos.filter(
        (c) =>
          c.fantasia.toLowerCase().includes(q) ||
          c.assunto.toLowerCase().includes(q) ||
          c.grupoEconomico.toLowerCase().includes(q) ||
          c.tecnico.toLowerCase().includes(q) ||
          String(c.rns ?? '').includes(q),
      ),
    }));
  });

  readonly semanas = computed<(DiaAlocacaoBi | null)[][]>(() => {
    const dias = this.dias();
    if (dias.length === 0) return [];
    const celulas: (DiaAlocacaoBi | null)[] = [
      ...Array<null>(dias[0].diaSemana).fill(null),
      ...dias,
    ];
    while (celulas.length % 7 !== 0) celulas.push(null);
    const semanas: (DiaAlocacaoBi | null)[][] = [];
    for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
    return semanas;
  });

  readonly compromissosVisiveis = computed(() => this.dias().flatMap((d) => d.compromissos));

  readonly totalVisivel = computed(
    () => new Set(this.compromissosVisiveis().map((c) => c.codigo)).size,
  );

  readonly horasVisiveis = computed(
    () => Math.round(this.compromissosVisiveis().reduce((s, c) => s + c.minutos, 0) / 6) / 10,
  );

  readonly tecnicosVisiveis = computed(
    () => new Set(this.compromissosVisiveis().map((c) => c.tecnico).filter(Boolean)).size,
  );

  readonly resumo = computed(() => {
    const todos = this.compromissosVisiveis();
    const cont = new Map<string, number>();
    for (const c of todos) cont.set(c.status, (cont.get(c.status) ?? 0) + 1);
    const total = todos.length;
    const cores = new Map(
      (this.resultado()?.resumo ?? []).map((r) => [r.status, r.cor] as const),
    );
    return [...cont.entries()]
      .map(([status, quantidade]) => ({
        status,
        quantidade,
        percentual: total > 0 ? Math.round((quantidade / total) * 1000) / 10 : 0,
        cor: cores.get(status) ?? '#CCCCCC',
      }))
      .sort((a, b) => a.status.localeCompare(b.status, 'pt-BR'));
  });

  readonly detalheDoDia = computed<DiaAlocacaoBi | null>(() => {
    const alvo = this.diaAberto();
    return alvo ? (this.dias().find((d) => d.dia === alvo) ?? null) : null;
  });

  // ── Mapa de calor por técnico ────────────────────────────────────────────────────

  /** Colunas do mapa: os dias ÚTEIS do mês mais qualquer sábado/domingo que tenha agenda —
   * fim de semana vazio só ocuparia espaço, mas visita de sábado não pode sumir. */
  readonly diasMapa = computed<DiaAlocacaoBi[]>(() => {
    const comAgenda = new Set(this.compromissosVisiveis().map((c) => c.dia));
    return this.dias().filter(
      (d) => (d.diaSemana >= 1 && d.diaSemana <= 5) || comAgenda.has(d.dia),
    );
  });

  private readonly turnosUteis = computed(
    () => this.dias().filter((d) => d.diaSemana >= 1 && d.diaSemana <= 5).length * 2,
  );

  readonly tecnicos = computed<TecnicoAlocacaoBi[]>(() => {
    const porTecnico = new Map<string, LinhaAlocacaoBi[]>();
    for (const c of this.compromissosVisiveis()) {
      const nome = c.tecnico || 'Não informado';
      const lista = porTecnico.get(nome) ?? [];
      lista.push(c);
      porTecnico.set(nome, lista);
    }

    const colunas = this.diasMapa();
    const uteis = this.turnosUteis();

    return [...porTecnico.entries()]
      .map(([nome, cs]) => {
        const porDia = new Map<string, LinhaAlocacaoBi[]>();
        for (const c of cs) {
          const lista = porDia.get(c.dia) ?? [];
          lista.push(c);
          porDia.set(c.dia, lista);
        }

        const dias = colunas.map<DiaTecnicoBi>((d) => {
          const doDia = porDia.get(d.dia) ?? [];
          return {
            dia: d.dia,
            numero: d.numero,
            letra: LETRA_SEMANA[d.diaSemana],
            manha: this.montarTurno(nome, d.dia, 'manha', doDia.filter((c) => this.ehManha(c))),
            tarde: this.montarTurno(nome, d.dia, 'tarde', doDia.filter((c) => !this.ehManha(c))),
          };
        });

        const ocupados = dias.reduce(
          (s, d) => s + (d.manha.minutos > 0 ? 1 : 0) + (d.tarde.minutos > 0 ? 1 : 0),
          0,
        );
        const minutos = cs.reduce((s, c) => s + c.minutos, 0);

        return {
          nome,
          inicial: (nome.trim()[0] ?? '?').toUpperCase(),
          horas: Math.round(minutos / 6) / 10,
          compromissos: new Set(cs.map((c) => c.codigo)).size,
          turnosOcupados: ocupados,
          turnosUteis: uteis,
          utilizacao: uteis > 0 ? Math.round((ocupados / uteis) * 100) : 0,
          dias,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });

  /** Deriva do `turnoAberto`, e não de uma cópia: se o filtro esvaziar o turno escolhido, o
   * painel da direita volta sozinho para o estado vazio em vez de mostrar dado fantasma. */
  readonly detalheTurno = computed<TurnoAlocacaoBi | null>(() => {
    const alvo = this.turnoAberto();
    if (!alvo) return null;
    const dia = this.tecnicos()
      .find((t) => t.nome === alvo.tecnico)
      ?.dias.find((d) => d.dia === alvo.dia);
    const turno = alvo.turno === 'manha' ? dia?.manha : dia?.tarde;
    return turno && turno.minutos > 0 ? turno : null;
  });

  readonly tecnicoAberto = computed(() => this.turnoAberto()?.tecnico ?? null);

  readonly rotuloMes = computed(() => {
    const [ano, m] = (this.resultado()?.mes ?? this.mes).split('-').map(Number);
    return m ? `${NOMES_MES[m]} de ${ano}` : '';
  });

  constructor() {
    void this.carregar();
  }

  private ehManha(c: LinhaAlocacaoBi): boolean {
    return (c.horaIni || '00:00') < FIM_DA_MANHA;
  }

  /** Cor do quadrinho: o status que domina o turno EM MINUTOS — uma agenda de 4h pesa mais
   * que três de 20min, e é ela que descreve o turno. */
  private corDominante(cs: LinhaAlocacaoBi[]): string {
    const porStatus = new Map<string, number>();
    for (const c of cs) porStatus.set(c.status, (porStatus.get(c.status) ?? 0) + c.minutos);
    let dominante = '';
    let maior = -1;
    for (const [status, minutos] of porStatus) {
      if (minutos > maior) {
        maior = minutos;
        dominante = status;
      }
    }
    return this.corBorda(dominante);
  }

  private montarTurno(
    tecnico: string,
    dia: string,
    turno: NomeTurno,
    cs: LinhaAlocacaoBi[],
  ): TurnoAlocacaoBi {
    const rotulo = turno === 'manha' ? 'MANHÃ' : 'TARDE';
    const minutos = cs.reduce((s, c) => s + c.minutos, 0);
    const carga = minutos === 0 ? 0 : minutos <= 120 ? 1 : minutos <= 240 ? 2 : 3;
    const ordenados = [...cs].sort((a, b) => a.horaIni.localeCompare(b.horaIni));
    return {
      tecnico,
      dia,
      turno,
      rotulo,
      compromissos: ordenados,
      minutos,
      carga,
      fundo:
        carga === 0
          ? ''
          : `color-mix(in srgb, ${this.corDominante(cs)} ${MISTURA_CARGA[carga]}%, #ffffff)`,
      dica:
        carga === 0
          ? `${this.dataBr(dia)} · ${rotulo} — livre`
          : `${this.dataBr(dia)} · ${rotulo} — ${cs.length} agenda(s) · ${this.duracao(minutos)}`,
    };
  }

  /** "50m", "2h", "2h 30m" — mesmo formato dos cards do painel da direita. */
  duracao(minutos: number): string {
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  private faixaCriticidade(minutos: number) {
    return CRITICIDADE.find((f) => minutos < f.ate) ?? CRITICIDADE[CRITICIDADE.length - 1];
  }

  criticidade(minutos: number): string {
    return this.faixaCriticidade(minutos).rotulo;
  }

  corCriticidade(minutos: number): string {
    return this.faixaCriticidade(minutos).cor;
  }

  definirVisao(v: 'tecnico' | 'calendario'): void {
    this.visao.set(v);
  }

  abrirTurno(t: TurnoAlocacaoBi): void {
    if (t.minutos === 0) return;
    this.turnoAberto.update((v) =>
      v && v.tecnico === t.tecnico && v.dia === t.dia && v.turno === t.turno
        ? null
        : { tecnico: t.tecnico, dia: t.dia, turno: t.turno },
    );
  }

  /** Clicar no cabeçalho do técnico abre o primeiro turno ocupado dele — sem isso, o único
   * jeito de ver as agendas seria acertar um quadrinho de 14px. */
  abrirTecnico(t: TecnicoAlocacaoBi): void {
    if (this.tecnicoAberto() === t.nome) {
      this.turnoAberto.set(null);
      return;
    }
    for (const d of t.dias) {
      const turno = d.manha.minutos > 0 ? d.manha : d.tarde.minutos > 0 ? d.tarde : null;
      if (turno) {
        this.turnoAberto.set({ tecnico: turno.tecnico, dia: turno.dia, turno: turno.turno });
        return;
      }
    }
  }

  turnoSelecionado(t: TurnoAlocacaoBi): boolean {
    const v = this.turnoAberto();
    return !!v && v.tecnico === t.tecnico && v.dia === t.dia && v.turno === t.turno;
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.diaAberto.set(null);
    this.turnoAberto.set(null);
    try {
      const r = await this.service.calendario({
        mes: this.mes || undefined,
        grupo: this.gruposSel(),
        responsavel: this.tecnicosSel(),
        tipoSuporte: this.tipoSuporteSel(),
        status: this.statusSel(),
      });
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
      this.mes = r.mes;
    } catch (e) {
      this.erro.set(mensagemErroBi(e, 'a Alocação de Agendas'));
    } finally {
      this.carregando.set(false);
    }
  }

  async navegarMes(passo: number): Promise<void> {
    const [ano, m] = (this.mes || new Date().toISOString().slice(0, 7)).split('-').map(Number);
    const total = (ano * 12 + (m - 1)) + passo;
    const novoAno = Math.floor(total / 12);
    const novoMes = (total % 12) + 1;
    this.mes = `${novoAno}-${String(novoMes).padStart(2, '0')}`;
    await this.carregar();
  }

  alternarFiltros(): void {
    this.store.alternarFiltros();
  }

  alternar(selecao: WritableSignal<string[]>, valor: string): void {
    selecao.update((v) => (v.includes(valor) ? v.filter((x) => x !== valor) : [...v, valor]));
    void this.carregar();
  }

  marcado(selecao: WritableSignal<string[]>, valor: string): boolean {
    return selecao().includes(valor);
  }

  async limparFiltros(): Promise<void> {
    this.store.limpar();
    this.statusSel.set([]);
    await this.carregar();
  }

  termoOpcao(bloco: string): string {
    return this.buscaOpcoes()[bloco] ?? '';
  }

  definirTermoOpcao(bloco: string, valor: string): void {
    this.buscaOpcoes.update((m) => ({ ...m, [bloco]: valor }));
  }

  opcoes(bloco: string, lista: string[], selecao: WritableSignal<string[]>) {
    return opcoesVisiveis(lista, this.termoOpcao(bloco), (v) => v, (v) => selecao().includes(v));
  }

  abrirDia(dia: DiaAlocacaoBi | null): void {
    if (!dia || dia.compromissos.length === 0) return;
    this.diaAberto.update((v) => (v === dia.dia ? null : dia.dia));
  }

  corBorda(status: string): string {
    return COR_BORDA[status] ?? '#9e9e9e';
  }

  rotuloStatus(status: string): string {
    const p = (status ?? '').split('-');
    return p.length > 1 ? p.slice(1).join('-') : status;
  }

  dataBr(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  ehHoje(dia: string): boolean {
    return dia === new Date().toISOString().slice(0, 10);
  }

  exportarCsv(): void {
    const cab = [
      'Dia', 'Início', 'Fim', 'Status', 'Técnico', 'Tipo de suporte',
      'Cliente', 'Grupo econômico', 'RNS', 'Minutos', 'Assunto',
    ];
    const escapar = (v: string | number): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = this.compromissosVisiveis().map((c: LinhaAlocacaoBi) =>
      [
        c.dia, c.horaIni, c.horaFim, c.status, c.tecnico, c.tipoSuporte,
        c.fantasia, c.grupoEconomico, c.rns ?? '', c.minutos, c.assunto,
      ].map(escapar).join(';'),
    );
    // `\uFEFF` (BOM) na frente do CSV: é o que faz o Excel abrir o arquivo
    // como UTF-8 em vez de ANSI (sem ele, acento sai trocado na planilha).
    const csv = `\uFEFF${cab.join(';')}\n${linhas.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `alocacao_agendas_${this.mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
