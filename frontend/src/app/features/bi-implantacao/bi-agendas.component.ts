import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BiAbasComponent } from './bi-abas.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';
import {
  DiaAgendaBi,
  LinhaAgendaBi,
  OpcaoRnsBi,
  ResultadoAgendasBi,
} from '../../core/models/bi-implantacao.model';
import { opcoesVisiveis } from './bi-filtros.util';
import { mensagemErroBi } from './bi-erro.util';
import { BiFiltrosStore } from './bi-filtros.store';

const NOMES_MES = [
  '', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Cor da BORDA de cada status. O fundo pastel vem do backend (as cores da medida
 * `Calendario`); pastel puro não dá contraste suficiente para leitura rápida, então a borda
 * repete o status em tom forte. */
const COR_BORDA: Record<string, string> = {
  '1-Solicitada': '#e6c200',
  '3-Agendada': '#00b300',
  '6-Realizada': '#ffaa00',
  '7-Não realizada': '#b8860b',
  '8-Postergada': '#9e9e9e',
  '9-Cancelada': '#e53935',
};

@Component({
  selector: 'app-bi-agendas',
  standalone: true,
  imports: [FormsModule, BiAbasComponent],
  templateUrl: './bi-agendas.component.html',
  styleUrls: ['./bi-comum.css', './bi-agendas.component.css'],
})
export class BiAgendasComponent {
  private readonly service = inject(BiImplantacaoService);
  private readonly store = inject(BiFiltrosStore);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoAgendasBi | null>(null);
  readonly filtrosAbertos = this.store.filtrosAbertos;
  readonly buscaOpcoes = this.store.buscaOpcoes;
  readonly busca = this.store.busca;

  readonly gruposSel = this.store.grupo;
  readonly tecnicosSel = this.store.tecnico;
  readonly statusImpSel = this.store.statusImplantacao;
  readonly rnsSel = this.store.rns;
  /** Status da AGENDA — não é o da implantação nem o da RNS; vive só nesta tela. */
  readonly statusSel = signal<string[]>([]);

  /** Dia aberto no detalhe (AAAA-MM-DD) ou null. */
  readonly diaAberto = signal<string | null>(null);

  /** Mês exibido, via store para sobreviver à troca de aba. */
  get mes(): string { return this.store.mesAgenda(); }
  set mes(v: string) { this.store.mesAgenda.set(v); }

  readonly filtros = computed(() => this.resultado()?.filtros ?? null);

  readonly qtdFiltrosAtivos = computed(
    () =>
      this.gruposSel().length +
      this.tecnicosSel().length +
      this.statusImpSel().length +
      this.rnsSel().length +
      this.statusSel().length +
      (this.busca().trim() ? 1 : 0),
  );

  /** Dias com a busca textual aplicada — como nas outras telas, tudo deriva do visível. */
  readonly dias = computed<DiaAgendaBi[]>(() => {
    const todos = this.resultado()?.dias ?? [];
    const q = this.busca().trim().toLowerCase();
    if (!q) return todos;
    return todos.map((d) => ({
      ...d,
      agendas: d.agendas.filter(
        (a) =>
          a.clienteFantasia.toLowerCase().includes(q) ||
          a.assunto.toLowerCase().includes(q) ||
          a.grupoEconomico.toLowerCase().includes(q) ||
          a.participantes.some((p) => p.toLowerCase().includes(q)) ||
          String(a.rnsImplantacao).includes(q),
      ),
    }));
  });

  /** Grade do calendário: preenche o começo da 1ª semana para o mês cair no dia certo. */
  readonly semanas = computed<(DiaAgendaBi | null)[][]>(() => {
    const dias = this.dias();
    if (dias.length === 0) return [];
    const celulas: (DiaAgendaBi | null)[] = [
      ...Array<null>(dias[0].diaSemana).fill(null),
      ...dias,
    ];
    while (celulas.length % 7 !== 0) celulas.push(null);
    const semanas: (DiaAgendaBi | null)[][] = [];
    for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
    return semanas;
  });

  readonly agendasVisiveis = computed(() => this.dias().flatMap((d) => d.agendas));

  /** Recontado sobre o visível — o backend já manda o resumo, mas ele não conhece a busca. */
  readonly resumo = computed(() => {
    const todas = this.agendasVisiveis();
    const cont = new Map<string, number>();
    for (const a of todas) cont.set(a.status, (cont.get(a.status) ?? 0) + 1);
    const total = todas.length;
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

  readonly totalVisivel = computed(() => this.agendasVisiveis().length);

  readonly horasVisiveis = computed(
    () => Math.round(this.agendasVisiveis().reduce((s, a) => s + a.horasDuracao, 0) * 10) / 10,
  );

  readonly consultoresVisiveis = computed(
    () => new Set(this.agendasVisiveis().flatMap((a) => a.participantes)).size,
  );

  readonly detalheDoDia = computed<DiaAgendaBi | null>(() => {
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
      const r = await this.service.agendas({
        mes: this.mes || undefined,
        grupo: this.gruposSel(),
        tecnico: this.tecnicosSel(),
        status: this.statusSel(),
        statusImplantacao: this.statusImpSel(),
        rns: this.rnsSel(),
      });
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
      this.mes = r.mes;
    } catch (e) {
      this.erro.set(mensagemErroBi(e, 'as Agendas'));
    } finally {
      this.carregando.set(false);
    }
  }

  /** Navega N meses (±1) mantendo os filtros. */
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

  opcoesRns(bloco: string, lista: OpcaoRnsBi[]) {
    return opcoesVisiveis(
      lista,
      this.termoOpcao(bloco),
      (o) => o.rotulo,
      (o) => this.rnsSel().includes(o.codigo),
    );
  }

  abrirDia(dia: DiaAgendaBi | null): void {
    if (!dia || dia.agendas.length === 0) return;
    this.diaAberto.update((v) => (v === dia.dia ? null : dia.dia));
  }

  corBorda(status: string): string {
    return COR_BORDA[status] ?? '#9e9e9e';
  }

  /** Só o rótulo curto do status ("6-Realizada" → "Realizada"). */
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
      'Dia', 'Início', 'Fim', 'Turno', 'Status', 'Status original', 'Espécie',
      'Cliente', 'Grupo econômico', 'Participantes', 'Responsável',
      'RNS implantação', 'Status implantação', 'Horas', 'Assunto',
    ];
    const escapar = (v: string | number): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = this.agendasVisiveis().map((a: LinhaAgendaBi) =>
      [
        a.dia, a.horaIni, a.horaFim, a.turno, a.status, a.statusOriginal, a.especieDes,
        a.clienteFantasia, a.grupoEconomico, a.participantes.join(' / '), a.responsavel,
        a.rnsImplantacao, a.statusImplantacao, a.horasDuracao, a.assunto,
      ].map(escapar).join(';'),
    );
    const csv = `﻿${cab.join(';')}\n${linhas.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `agendas_${this.mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
