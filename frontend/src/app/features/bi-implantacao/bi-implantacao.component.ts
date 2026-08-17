import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { BiAbasComponent } from './bi-abas.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';
import {
  AgrupamentoBi,
  LinhaResumoBi,
  LinhaVisitaPortalBi,
  OpcaoRnsBi,
  ResultadoResumoBi,
  ResultadoVisitasPortalBi,
} from '../../core/models/bi-implantacao.model';
import { opcoesVisiveis } from './bi-filtros.util';
import { mensagemErroBi } from './bi-erro.util';
import { BiFiltrosStore } from './bi-filtros.store';

/** Cores por status — as MESMAS do relatório original (medida DAX do calendário do
 * `BI_clientes.pbix`), para quem vem do Power BI reconhecer a tela de imediato. */
const COR_STATUS: Record<string, string> = {
  '1': '#9C27B0', // Não iniciado
  '2': '#7E57C2', // Levantamento de Projeto
  '3': '#2196F3', // Em Treinamento
  '4': '#00ACC1', // Simulações
  '5': '#4CAF50', // Uso Oficial
  '6': '#2E7D32', // Concluída
  '7': '#FF9800', // Parada
  '8': '#F44336', // Cancelada
};
const COR_PADRAO = '#78909C';

type Ordenacao = keyof Pick<
  LinhaResumoBi,
  | 'codigo'
  | 'fantasia'
  | 'tecnico'
  | 'statusRns'
  | 'dataContratacao'
  | 'horasPrevistas'
  | 'horasRealizadas'
  | 'horasSaldo'
  | 'grupoEconomico'
>;

@Component({
  selector: 'app-bi-implantacao',
  standalone: true,
  imports: [FormsModule, ChartDirective, BiAbasComponent],
  templateUrl: './bi-implantacao.component.html',
  styleUrls: ['./bi-comum.css', './bi-implantacao.component.css'],
})
export class BiImplantacaoComponent {
  private readonly service = inject(BiImplantacaoService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoResumoBi | null>(null);

  // ── Painel "Visitas do Portal Rech" (abaixo do CONTROLE DE HORAS) ──────────────────
  readonly visitasResultado = signal<ResultadoVisitasPortalBi | null>(null);
  readonly carregandoVisitas = signal(false);
  readonly erroVisitas = signal<string | null>(null);
  /** Período já buscado — evita reconsultar o banco a cada clique de filtro (os filtros
   * de cliente são aplicados em memória; só o De/Até muda o recorte que vai ao banco). */
  private periodoVisitas = '';

  // Filtros vindos do STORE compartilhado: o que se marca aqui vale nas outras abas.
  private readonly store = inject(BiFiltrosStore);
  readonly filtrosAbertos = this.store.filtrosAbertos;
  readonly buscaOpcoes = this.store.buscaOpcoes;
  readonly busca = this.store.busca;

  /** Período via store, mas exposto como propriedade para o `[(ngModel)]` dos inputs. */
  get dataIni(): string { return this.store.dataIni(); }
  set dataIni(v: string) { this.store.dataIni.set(v); }
  get dataFim(): string { return this.store.dataFim(); }
  set dataFim(v: string) { this.store.dataFim.set(v); }

  // Os `computed` da tela dependem destes signals; por isso o estado é signal e não campo
  // comum — um computed só recalcula quando uma dependência reativa muda.
  readonly gruposSel = this.store.grupo;
  readonly statusSel = this.store.statusImplantacao;
  readonly tecnicosSel = this.store.tecnico;
  readonly ativosSel = this.store.ativo;
  readonly tiposSel = this.store.tipoCliente;
  readonly rnsSel = this.store.rns;

  readonly ordenarPor = signal<Ordenacao>('dataContratacao');
  readonly ordemDesc = signal(true);

  readonly totais = computed(() => this.resultado()?.totais ?? null);
  readonly filtros = computed(() => this.resultado()?.filtros ?? null);

  /** Quantos filtros estão marcados — mostra no botão para o usuário não "perder" um filtro. */
  readonly qtdFiltrosAtivos = computed(
    () =>
      this.gruposSel().length +
      this.statusSel().length +
      this.tecnicosSel().length +
      this.ativosSel().length +
      this.tiposSel().length +
      this.rnsSel().length +
      (this.busca().trim() ? 1 : 0),
  );

  /** A busca textual é local (não vai ao banco): filtra o que já veio do período. */
  readonly linhas = computed(() => {
    const todas = this.resultado()?.linhas ?? [];
    const q = this.busca().trim().toLowerCase();
    const filtradas = q
      ? todas.filter(
          (l) =>
            l.fantasia.toLowerCase().includes(q) ||
            l.descricao.toLowerCase().includes(q) ||
            l.grupoEconomico.toLowerCase().includes(q) ||
            String(l.codigo).includes(q),
        )
      : todas;
    const campo = this.ordenarPor();
    const sinal = this.ordemDesc() ? -1 : 1;
    return [...filtradas].sort((a, b) => {
      const x = a[campo];
      const y = b[campo];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sinal;
      return String(x).localeCompare(String(y), 'pt-BR') * sinal;
    });
  });

  /** Totais da tabela visível — recalculados quando a busca local corta linhas. */
  readonly totaisVisiveis = computed(() => {
    const l = this.linhas();
    const s = (f: (x: LinhaResumoBi) => number) =>
      Math.round(l.reduce((a, x) => a + f(x), 0) * 100) / 100;
    return {
      quantidade: l.length,
      horasPrevistas: s((x) => x.horasPrevistas),
      horasRealizadas: s((x) => x.horasRealizadas),
      horasSaldo: s((x) => x.horasSaldo),
      horasCobradas: s((x) => x.horasCobradas),
      horasBonificadas: s((x) => x.horasBonificadas),
    };
  });

  /** Visitas do Portal Rech restritas aos CLIENTES visíveis na tabela — assim TODOS os
   * filtros da tela (grupo, RNS, consultor, busca…) valem também neste painel, sempre
   * respeitando o cliente filtrado. O casamento é pelo código do cliente no SICLA
   * (`CODIGO_CLIENTE` do Portal), com fallback pelo nome fantasia quando a consulta
   * editada não devolver o código. */
  readonly visitasVisiveis = computed<LinhaVisitaPortalBi[]>(() => {
    const r = this.visitasResultado();
    if (!r) return [];
    const codigos = new Set<number>();
    const nomes = new Set<string>();
    for (const l of this.linhas()) {
      if (l.cliente !== null && l.cliente !== undefined) codigos.add(l.cliente);
      const nome = (l.fantasia || '').trim().toUpperCase();
      if (nome) nomes.add(nome);
    }
    return r.linhas.filter(
      (v) =>
        (v.cliente !== null && codigos.has(v.cliente)) ||
        nomes.has((v.empresa || '').trim().toUpperCase()),
    );
  });

  readonly visitasAprovadas = computed(
    () => this.visitasVisiveis().filter((v) => this.aprovadoSim(v.aprovado)).length,
  );

  aprovadoSim(aprovado: string): boolean {
    return (aprovado || '').trim().toLowerCase() === 'sim';
  }

  /** Painel "CONTROLE DE HORAS" — porte fiel da medida DAX `Grafico_Horas_HTML` do
   * `BI_clientes.pbix`, reescrita em Angular (o original montava HTML dentro do DAX).
   *
   * Regras mantidas exatamente como no original:
   *  - SALDO = previstas − realizadas (não a coluna HORASALDO);
   *  - as barras ocupam 4 faixas de 25%; passando de 100%, comprimem para 85% e os 15%
   *    finais viram a faixa "excedente", com o marcador em 85 + (min(%,150) − 100) × 0,15;
   *  - faixas de status e cores por percentual. */
  readonly controleHoras = computed(() => {
    const t = this.totaisVisiveis();
    const previstas = t.horasPrevistas;
    const realizadas = t.horasRealizadas;
    const pct = previstas > 0 ? (realizadas / previstas) * 100 : 0;
    const temExcedente = pct > 100;

    const status =
      pct <= 25 ? 'INICIADO'
      : pct <= 50 ? 'DESENVOLVIMENTO'
      : pct <= 75 ? 'AVANÇADO'
      : pct <= 100 ? 'FINALIZADO'
      : 'ULTRAPASSADO';
    const corStatus =
      pct <= 25 ? '#10b981'
      : pct <= 50 ? '#fbbf24'
      : pct <= 75 ? '#fb923c'
      : pct <= 100 ? '#ef4444'
      : '#1f2937';

    const saldo = Math.round((previstas - realizadas) * 100) / 100;
    return {
      previstas,
      realizadas,
      saldo,
      cobradas: t.horasCobradas,
      bonificadas: t.horasBonificadas,
      percentual: Math.round(pct * 10) / 10,
      status,
      corStatus,
      corSaldo: saldo >= 0 ? '#10b981' : '#ef4444',
      temExcedente,
      /** Largura de cada uma das 4 faixas coloridas, em %. */
      larguraFaixa: temExcedente ? 21.25 : 25,
      /** Posição do marcador na régua, em % da largura total. */
      posicaoMarcador: temExcedente ? 85 + (Math.min(pct, 150) - 100) * 0.15 : pct,
    };
  });

  private corDe(chave: string): string {
    return COR_STATUS[chave.trim().charAt(0)] ?? COR_PADRAO;
  }

  /** Agrupa SOBRE AS LINHAS VISÍVEIS. O backend já devolve os mesmos agrupamentos, mas
   * calculados antes da busca textual (que é local) — usá-los deixaria os gráficos e o
   * top-10 mostrando um conjunto diferente do da tabela. Todo painel desta tela deriva de
   * `linhas()`, para que TODOS os filtros valham em TODOS os painéis. */
  private agruparVisiveis(
    chave: (l: LinhaResumoBi) => string,
    ordenarPorChave = false,
  ): AgrupamentoBi[] {
    const mapa = new Map<string, AgrupamentoBi>();
    for (const l of this.linhas()) {
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
    const arred = (n: number) => Math.round(n * 100) / 100;
    const out = [...mapa.values()].map((a) => ({
      ...a,
      horasPrevistas: arred(a.horasPrevistas),
      horasRealizadas: arred(a.horasRealizadas),
      horasSaldo: arred(a.horasSaldo),
    }));
    return ordenarPorChave
      ? out.sort((x, y) => x.chave.localeCompare(y.chave))
      : out.sort((x, y) => y.horasRealizadas - x.horasRealizadas || y.quantidade - x.quantidade);
  }

  readonly porStatusVisivel = computed(() => this.agruparVisiveis((l) => l.statusRns, true));
  readonly porTecnicoVisivel = computed(() => this.agruparVisiveis((l) => l.tecnico));

  /** Previsto × realizado por status. */
  readonly graficoStatus = computed<ChartConfiguration | null>(() => {
    const dados = this.porStatusVisivel();
    if (dados.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: dados.map((d) => d.chave),
        datasets: [
          {
            label: 'Horas previstas',
            data: dados.map((d) => d.horasPrevistas),
            backgroundColor: dados.map((d) => `${this.corDe(d.chave)}55`),
            borderColor: dados.map((d) => this.corDe(d.chave)),
            borderWidth: 1,
          },
          {
            label: 'Horas realizadas',
            data: dados.map((d) => d.horasRealizadas),
            backgroundColor: dados.map((d) => this.corDe(d.chave)),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              afterBody: (itens) => {
                const d = dados[itens[0]?.dataIndex ?? 0];
                return d ? `RNS: ${d.quantidade}  |  saldo: ${this.horas(d.horasSaldo)}` : '';
              },
            },
          },
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'horas' } } },
      },
    };
  });

  readonly topTecnicos = computed<AgrupamentoBi[]>(() => this.porTecnicoVisivel().slice(0, 10));

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.resumo({
        dataIni: this.dataIni || undefined,
        dataFim: this.dataFim || undefined,
        grupo: this.gruposSel(),
        status: this.statusSel(),
        tecnico: this.tecnicosSel(),
        ativo: this.ativosSel(),
        tipoCliente: this.tiposSel(),
        rns: this.rnsSel(),
      });
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
      this.dataIni = r.periodo.inicio;
      this.dataFim = r.periodo.fim;
      void this.carregarVisitas(r.periodo.inicio, r.periodo.fim);
    } catch (e) {
      this.erro.set(mensagemErroBi(e, 'o Resumo de Implantação'));
    } finally {
      this.carregando.set(false);
    }
  }

  /** Busca as visitas do Portal Rech do período — só volta ao banco quando o De/Até muda;
   * o recorte por cliente é aplicado em memória (`visitasVisiveis`). */
  private async carregarVisitas(inicio: string, fim: string): Promise<void> {
    const chave = `${inicio}|${fim}`;
    if (chave === this.periodoVisitas) return;
    this.periodoVisitas = chave;
    this.carregandoVisitas.set(true);
    this.erroVisitas.set(null);
    try {
      const r = await this.service.visitasPortal({ dataIni: inicio, dataFim: fim });
      this.visitasResultado.set(r);
      if (r.erro) this.erroVisitas.set(r.erro);
    } catch (e) {
      this.visitasResultado.set(null);
      this.erroVisitas.set(mensagemErroBi(e, 'as Visitas do Portal Rech'));
      this.periodoVisitas = ''; // permite tentar de novo no próximo carregar()
    } finally {
      this.carregandoVisitas.set(false);
    }
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

  /** Limpa TODOS os filtros compartilhados — inclusive os que só existem em outra aba,
   * senão um filtro invisível aqui continuaria valendo lá. */
  async limparFiltros(): Promise<void> {
    this.store.limpar();
    await this.carregar();
  }

  // ── Busca dentro dos blocos de filtro (listas com centenas de opções) ─────────────
  termoOpcao(bloco: string): string {
    return this.buscaOpcoes()[bloco] ?? '';
  }

  definirTermoOpcao(bloco: string, valor: string): void {
    this.buscaOpcoes.update((m) => ({ ...m, [bloco]: valor }));
  }

  /** Opções de texto simples (status, técnico, grupo…) já filtradas e limitadas. */
  opcoes(bloco: string, lista: string[], selecao: WritableSignal<string[]>) {
    return opcoesVisiveis(
      lista,
      this.termoOpcao(bloco),
      (v) => v,
      (v) => selecao().includes(v),
    );
  }

  /** Opções do filtro de RNS (código + cliente no rótulo). */
  opcoesRns(bloco: string, lista: OpcaoRnsBi[]) {
    return opcoesVisiveis(
      lista,
      this.termoOpcao(bloco),
      (o) => o.rotulo,
      (o) => this.rnsSel().includes(o.codigo),
    );
  }

  ordenar(campo: Ordenacao): void {
    if (this.ordenarPor() === campo) this.ordemDesc.update((v) => !v);
    else {
      this.ordenarPor.set(campo);
      this.ordemDesc.set(true);
    }
  }

  /** "6.098h" — inteiro com separador de milhar, como o `FORMAT(x, "0")` do DAX. */
  horasInteiras(v: number): string {
    return `${Math.round(v).toLocaleString('pt-BR')}h`;
  }

  /** "+3.505h" / "-15h" / "0h" — equivale ao `FORMAT(saldo, "+0;-0;0") & "h"` do DAX. */
  saldoComSinal(v: number): string {
    const n = Math.round(v);
    const sinal = n > 0 ? '+' : n < 0 ? '-' : '';
    return `${sinal}${Math.abs(n).toLocaleString('pt-BR')}h`;
  }

  /** "12,5 h" — uma casa decimal, vírgula, sem exibir zero à toa. */
  horas(v: number): string {
    if (!v) return '—';
    return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  }

  dataBr(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  corStatus(status: string): string {
    return this.corDe(status);
  }

  /** Exporta o que está na tela para CSV (o "Exportar dados" do Power BI). */
  exportarCsv(): void {
    const cab = [
      'RNS', 'Cliente', 'Grupo econômico', 'Descrição', 'Consultor', 'Status',
      'Contratação', 'Prev. uso oficial', 'Encerramento',
      'Horas previstas', 'Horas realizadas', 'Saldo',
    ];
    const escapar = (v: string | number): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = this.linhas().map((l) =>
      [
        l.codigo, l.fantasia, l.grupoEconomico, l.descricao, l.tecnico, l.statusRns,
        l.dataContratacao, l.dataPrevUso, l.dataEncerramento,
        l.horasPrevistas, l.horasRealizadas, l.horasSaldo,
      ].map(escapar).join(';'),
    );
    // BOM para o Excel pt-BR abrir os acentos corretamente
    // `\uFEFF` (BOM) na frente do CSV: é o que faz o Excel abrir o arquivo
    // como UTF-8 em vez de ANSI (sem ele, acento sai trocado na planilha).
    const csv = `\uFEFF${cab.join(';')}\n${linhas.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo-implantacao_${this.dataIni}_a_${this.dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
