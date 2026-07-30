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

  readonly rotuloMes = computed(() => {
    const [ano, m] = (this.resultado()?.mes ?? this.mes).split('-').map(Number);
    return m ? `${NOMES_MES[m]} de ${ano}` : '';
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.diaAberto.set(null);
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
    const csv = `﻿${cab.join(';')}\n${linhas.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `alocacao_agendas_${this.mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
