import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BiIndicadoresAbasComponent } from './bi-indicadores-abas.component';
import { BiAgendaAlocacaoService } from '../../core/services/bi-agenda-alocacao.service';
import {
  LinhaHorasAplicadasBi,
  ResultadoHorasAplicadasBi,
} from '../../core/models/bi-agenda-alocacao.model';
import { opcoesVisiveis } from '../bi-implantacao/bi-filtros.util';
import { mensagemErroBi } from '../bi-implantacao/bi-erro.util';
import { BiIndicadoresStore } from './bi-indicadores.store';

/** "Horas Aplicadas" — quantas horas de compromisso cada RNS de implantação teve, por
 * status (Encaminhada/Agendada/Realizada/Não realizada/Postergada/Cancelada). Porte da
 * página homônima do `BI_Interno.pbix`.
 *
 * ⚠️ "Horas" aqui é literalmente `DATAFIM - DATAINI` somado por status — NÃO é contagem de
 * compromissos, apesar de a origem (`POWERBI_AGENDA_POSTERGACAO_IMP_2`) guardar um flag 0/1
 * por linha (ver bi-agenda-alocacao.constants.ts no backend para a verificação numérica). */
@Component({
  selector: 'app-bi-alocacao-horas',
  standalone: true,
  imports: [FormsModule, BiIndicadoresAbasComponent],
  templateUrl: './bi-alocacao-horas.component.html',
  styleUrls: ['../bi-implantacao/bi-comum.css', './bi-indicadores.css'],
})
export class BiAlocacaoHorasComponent {
  private readonly service = inject(BiAgendaAlocacaoService);
  readonly store = inject(BiIndicadoresStore);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoHorasAplicadasBi | null>(null);

  readonly filtros = computed(() => this.resultado()?.filtros ?? null);

  get compIni(): string { return this.store.compIni(); }
  set compIni(v: string) { this.store.compIni.set(v); }
  get compFim(): string { return this.store.compFim(); }
  set compFim(v: string) { this.store.compFim.set(v); }

  /** Como nas outras telas do BI: tudo deriva do que está visível após a busca local. */
  readonly linhas = computed<LinhaHorasAplicadasBi[]>(() => {
    const todas = this.resultado()?.linhas ?? [];
    const q = this.store.busca().trim().toLowerCase();
    if (!q) return todas;
    return todas.filter(
      (l) =>
        l.fantasia.toLowerCase().includes(q) ||
        l.rnsDescricao.toLowerCase().includes(q) ||
        l.responsavel.toLowerCase().includes(q) ||
        l.grupoEconomico.toLowerCase().includes(q) ||
        String(l.rns).includes(q),
    );
  });

  readonly totais = computed(() => {
    const l = this.linhas();
    const soma = (f: (x: LinhaHorasAplicadasBi) => number) =>
      Math.round(l.reduce((a, x) => a + f(x), 0) * 100) / 100;
    const total = soma((x) => x.horasTotal);
    const postergada = soma((x) => x.horasPostergada);
    return {
      rnsQuantidade: l.length,
      horasEncaminhada: soma((x) => x.horasEncaminhada),
      horasAgendada: soma((x) => x.horasAgendada),
      horasRealizada: soma((x) => x.horasRealizada),
      horasNaoRealizada: soma((x) => x.horasNaoRealizada),
      horasPostergada: postergada,
      horasCancelada: soma((x) => x.horasCancelada),
      horasTotal: total,
      percentualPostergada: total > 0 ? Math.round((postergada / total) * 1000) / 10 : null,
    };
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.horasAplicadas({
        compIni: this.store.compIni() || undefined,
        compFim: this.store.compFim() || undefined,
        grupo: this.store.grupo(),
        responsavel: this.store.responsavel(),
        tipoSuporte: this.store.tipoSuporte(),
      });
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
      this.store.compIni.set(r.competencias.inicio);
      this.store.compFim.set(r.competencias.fim);
    } catch (e) {
      this.erro.set(mensagemErroBi(e, 'as Horas Aplicadas'));
    } finally {
      this.carregando.set(false);
    }
  }

  alternarFiltros(): void {
    this.store.alternarFiltros();
  }

  alternar(sel: WritableSignal<string[]>, valor: string): void {
    this.store.alternar(sel, valor);
    void this.carregar();
  }

  marcado(sel: WritableSignal<string[]>, valor: string): boolean {
    return sel().includes(valor);
  }

  opcoes(bloco: string, lista: string[], sel: WritableSignal<string[]>) {
    return opcoesVisiveis(lista, this.store.termoOpcao(bloco), (v) => v, (v) => sel().includes(v));
  }

  async limparFiltros(): Promise<void> {
    this.store.limpar();
    await this.carregar();
  }

  horas(v: number): string {
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
  }

  exportarCsv(): void {
    const cab = [
      'RNS', 'Cliente', 'Responsável', 'Grupo econômico', 'Tipo de suporte', 'Compromissos',
      'Horas encaminhada', 'Horas agendada', 'Horas realizada', 'Horas não realizada',
      'Horas postergada', 'Horas cancelada', 'Horas total', '% postergada',
    ];
    const escapar = (v: string | number): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = this.linhas().map((l) =>
      [
        l.rns, l.fantasia, l.responsavel, l.grupoEconomico, l.tipoSuporte, l.qtdCompromissos,
        l.horasEncaminhada, l.horasAgendada, l.horasRealizada, l.horasNaoRealizada,
        l.horasPostergada, l.horasCancelada, l.horasTotal, l.percentualPostergada ?? '',
      ].map(escapar).join(';'),
    );
    const csv = `﻿${cab.join(';')}\n${linhas.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'horas_aplicadas.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
