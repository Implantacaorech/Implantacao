import { Injectable, WritableSignal, computed, signal } from '@angular/core';
import {
  FiltrosSalvos,
  deSignal,
  filtrosSalvos,
} from '../../core/utils/filtros-salvos';

/** Filtros das três telas de Indicadores (aba **BI Implantação**), compartilhados entre elas
 * pelo mesmo motivo do `BiFiltrosStore`: trocar de subaba recria o componente, e o filtro
 * escolhido tem de sobreviver. */
@Injectable({ providedIn: 'root' })
export class BiIndicadoresStore {
  /** Competências (AAAA-MM). Vazio = o backend decide (últimos 24 meses). */
  readonly compIni = signal('');
  readonly compFim = signal('');

  /** Mês do calendário de Alocação de Agendas (AAAA-MM) — igual a `mesAgenda` do outro BI:
   * aquela tela é mensal, não por período livre. */
  readonly mesAlocacao = signal('');

  /** Período (AAAA-MM-DD) de Movimentos de trabalho efetivo — SEPARADO de `compIni`/`compFim`
   * de propósito: aquela origem (663 mil linhas, sem índice) só responde rápido numa janela
   * curta (padrão 3 meses, teto de 6 — ver bi-movimentos.constants.ts no backend); usar o
   * mesmo período das outras três telas de Indicadores (padrão 24 meses) faria a consulta
   * demorar dezenas de segundos ou mais. */
  readonly movDataIni = signal('');
  readonly movDataFim = signal('');

  readonly posicao = signal<string[]>([]);
  readonly tipoImplantacao = signal<string[]>([]);
  readonly area = signal<string[]>([]);
  readonly tipoSuporte = signal<string[]>([]);
  readonly responsavel = signal<string[]>([]);
  readonly grupo = signal<string[]>([]);

  readonly busca = signal('');
  readonly buscaOpcoes = signal<Record<string, string>>({});
  /** Nasce fechado, como no outro BI. */
  readonly filtrosAbertos = signal(false);

  /** Seleção salva por usuário logado — incluindo as competências, que são o recorte de
   * trabalho. Fora: `filtrosAbertos` (nasce fechado) e `buscaOpcoes` (rascunho). */
  private readonly salvos: FiltrosSalvos = filtrosSalvos('bi-indicadores', {
    compIni: deSignal(this.compIni),
    compFim: deSignal(this.compFim),
    mesAlocacao: deSignal(this.mesAlocacao),
    movDataIni: deSignal(this.movDataIni),
    movDataFim: deSignal(this.movDataFim),
    posicao: deSignal(this.posicao),
    tipoImplantacao: deSignal(this.tipoImplantacao),
    area: deSignal(this.area),
    tipoSuporte: deSignal(this.tipoSuporte),
    responsavel: deSignal(this.responsavel),
    grupo: deSignal(this.grupo),
    busca: deSignal(this.busca),
  });

  private get selecoes(): WritableSignal<string[]>[] {
    return [
      this.posicao, this.tipoImplantacao, this.area,
      this.tipoSuporte, this.responsavel, this.grupo,
    ];
  }

  readonly qtdAtivos = computed(
    () =>
      this.posicao().length +
      this.tipoImplantacao().length +
      this.area().length +
      this.tipoSuporte().length +
      this.responsavel().length +
      this.grupo().length +
      (this.busca().trim() ? 1 : 0),
  );

  alternarFiltros(): void {
    this.filtrosAbertos.update((v) => !v);
  }

  alternar(sel: WritableSignal<string[]>, valor: string): void {
    sel.update((v) => (v.includes(valor) ? v.filter((x) => x !== valor) : [...v, valor]));
  }

  termoOpcao(bloco: string): string {
    return this.buscaOpcoes()[bloco] ?? '';
  }

  definirTermoOpcao(bloco: string, valor: string): void {
    this.buscaOpcoes.update((m) => ({ ...m, [bloco]: valor }));
  }

  /** Zera seleções e busca; o PERÍODO fica, é o recorte de trabalho. */
  limpar(): void {
    for (const s of this.selecoes) s.set([]);
    this.busca.set('');
    this.buscaOpcoes.set({});
    void this.salvos.descartar(); // "Limpar" volta ao padrão, não fixa o vazio
  }
}
