import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BiIndicadoresAbasComponent } from './bi-indicadores-abas.component';
import { BiMovimentosService } from '../../core/services/bi-movimentos.service';
import { ResultadoMovimentosBi } from '../../core/models/bi-movimentos.model';
import { opcoesVisiveis } from '../bi-implantacao/bi-filtros.util';
import { mensagemErroBi } from '../bi-implantacao/bi-erro.util';
import { BiIndicadoresStore } from './bi-indicadores.store';

/** "Movimentos de trabalho efetivo" — porte da página homônima do `BI_Interno.pbix`.
 *
 * ⚠️ Único BI cujo backend já entrega os dados AGREGADOS (a origem tem 663 mil linhas, sem
 * índice — ver bi-movimentos.constants.ts no backend). Por isso `busca`/filtros aqui operam
 * sobre o já-agregado `porTecnico`/`porTpMovimento`, não sobre linhas cruas: não existe
 * "linha de movimento" nesta tela, só totais por técnico e por tipo de movimento. Técnico,
 * tipo de movimento e "cobra hora" são filtros DESTA tela (não do `BiIndicadoresStore`
 * compartilhado): os nomes de técnico aqui vêm em MAIÚSCULAS (`TECNICODES`), formato
 * diferente do `responsavel` usado nas outras páginas — reaproveitar o mesmo filtro
 * misturaria dois vocabulários que não batem, o mesmo tipo de erro já cometido antes com
 * status de agenda × status de implantação. */
@Component({
  selector: 'app-bi-movimentos',
  standalone: true,
  imports: [FormsModule, BiIndicadoresAbasComponent],
  templateUrl: './bi-movimentos.component.html',
  styleUrls: ['../bi-implantacao/bi-comum.css', './bi-indicadores.css'],
})
export class BiMovimentosComponent {
  private readonly service = inject(BiMovimentosService);
  readonly store = inject(BiIndicadoresStore);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoMovimentosBi | null>(null);

  readonly filtros = computed(() => this.resultado()?.filtros ?? null);

  get dataIni(): string { return this.store.movDataIni(); }
  set dataIni(v: string) { this.store.movDataIni.set(v); }
  get dataFim(): string { return this.store.movDataFim(); }
  set dataFim(v: string) { this.store.movDataFim.set(v); }

  readonly tecnicoSel = signal<string[]>([]);
  readonly tpMovimentoSel = signal<string[]>([]);
  readonly cobraHoraSel = signal<string[]>([]);

  readonly qtdFiltrosAtivos = computed(
    () =>
      this.tecnicoSel().length +
      this.tpMovimentoSel().length +
      this.cobraHoraSel().length +
      (this.store.busca().trim() ? 1 : 0),
  );

  /** Como nas outras telas: o que se vê deriva do visível, não do agregado bruto do backend —
   * aqui "visível" é o técnico cujo nome bate com a busca. */
  readonly porTecnico = computed(() => {
    const todos = this.resultado()?.porTecnico ?? [];
    const q = this.store.busca().trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((t) => t.chave.toLowerCase().includes(q));
  });

  readonly porTpMovimento = computed(() => this.resultado()?.porTpMovimento ?? []);

  readonly totais = computed(() => {
    const visiveis = this.porTecnico();
    const soma = (f: (x: (typeof visiveis)[number]) => number) =>
      Math.round(visiveis.reduce((a, x) => a + f(x), 0) * 100) / 100;
    const total = soma((x) => x.horasTotal);
    const cobradas = soma((x) => x.horasCobradas);
    return {
      quantidade: visiveis.reduce((a, x) => a + x.quantidade, 0),
      tecnicos: visiveis.length,
      horasTotal: total,
      horasCobradas: cobradas,
      horasNaoCobradas: Math.round((total - cobradas) * 100) / 100,
      percentualCobradas: total > 0 ? Math.round((cobradas / total) * 1000) / 10 : null,
    };
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.movimentos({
        dataIni: this.store.movDataIni() || undefined,
        dataFim: this.store.movDataFim() || undefined,
        tecnico: this.tecnicoSel(),
        tpMovimento: this.tpMovimentoSel(),
        cobraHora: this.cobraHoraSel(),
      });
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
      this.store.movDataIni.set(r.periodo.inicio);
      this.store.movDataFim.set(r.periodo.fim);
    } catch (e) {
      this.erro.set(mensagemErroBi(e, 'os Movimentos de trabalho efetivo'));
    } finally {
      this.carregando.set(false);
    }
  }

  alternarFiltros(): void {
    this.store.alternarFiltros();
  }

  alternar(sel: WritableSignal<string[]>, valor: string): void {
    sel.update((v) => (v.includes(valor) ? v.filter((x) => x !== valor) : [...v, valor]));
    void this.carregar();
  }

  marcado(sel: WritableSignal<string[]>, valor: string): boolean {
    return sel().includes(valor);
  }

  opcoes(bloco: string, lista: string[], sel: WritableSignal<string[]>) {
    return opcoesVisiveis(lista, this.store.termoOpcao(bloco), (v) => v, (v) => sel().includes(v));
  }

  async limparFiltros(): Promise<void> {
    this.tecnicoSel.set([]);
    this.tpMovimentoSel.set([]);
    this.cobraHoraSel.set([]);
    this.store.busca.set('');
    await this.carregar();
  }

  horas(v: number): string {
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
  }

  exportarCsv(): void {
    const cab = ['Técnico', 'Movimentos', 'Horas total', 'Horas cobradas', 'Horas não cobradas', '% cobradas'];
    const escapar = (v: string | number): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = this.porTecnico().map((t) =>
      [t.chave, t.quantidade, t.horasTotal, t.horasCobradas, t.horasNaoCobradas, t.percentualCobradas ?? '']
        .map(escapar).join(';'),
    );
    // `\uFEFF` (BOM) na frente do CSV: é o que faz o Excel abrir o arquivo
    // como UTF-8 em vez de ANSI (sem ele, acento sai trocado na planilha).
    const csv = `\uFEFF${cab.join(';')}\n${linhas.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'movimentos_trabalho_efetivo.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
