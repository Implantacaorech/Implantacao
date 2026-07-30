import { Component, WritableSignal, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BiIndicadoresStore } from './bi-indicadores.store';
import { FiltrosIndicadoresBi } from '../../core/models/bi-indicadores.model';
import { opcoesVisiveis } from '../bi-implantacao/bi-filtros.util';

/** Barra de período/busca + painel de filtros das três telas de Indicadores. Fica num
 * componente próprio porque as três páginas usam exatamente o mesmo conjunto — duplicar o
 * markup faria as telas divergirem na primeira alteração. */
@Component({
  selector: 'app-bi-indicadores-filtros',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './bi-indicadores-filtros.component.html',
  styleUrls: ['../bi-implantacao/bi-comum.css'],
})
export class BiIndicadoresFiltrosComponent {
  readonly store = inject(BiIndicadoresStore);

  /** Opções vindas do backend (já em cascata). */
  readonly filtros = input<FiltrosIndicadoresBi | null>(null);
  readonly placeholderBusca = input('cliente, RNS, responsável…');
  readonly podeExportar = input(false);

  /** Disparado quando algo muda e a página precisa recarregar. */
  readonly mudou = output<void>();
  readonly exportar = output<void>();

  get compIni(): string { return this.store.compIni(); }
  set compIni(v: string) { this.store.compIni.set(v); }
  get compFim(): string { return this.store.compFim(); }
  set compFim(v: string) { this.store.compFim.set(v); }

  alternar(sel: WritableSignal<string[]>, valor: string): void {
    this.store.alternar(sel, valor);
    this.mudou.emit();
  }

  marcado(sel: WritableSignal<string[]>, valor: string): boolean {
    return sel().includes(valor);
  }

  opcoes(bloco: string, lista: string[], sel: WritableSignal<string[]>) {
    return opcoesVisiveis(
      lista,
      this.store.termoOpcao(bloco),
      (v) => v,
      (v) => sel().includes(v),
    );
  }

  limpar(): void {
    this.store.limpar();
    this.mudou.emit();
  }
}
