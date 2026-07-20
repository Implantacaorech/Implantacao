import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseConhecimentoService } from '../../core/services/base-conhecimento.service';
import { ResultadoBuscaSiger, StatusBaseConhecimentoSiger } from '../../core/models/siger-fonte.model';

const DEBOUNCE_MS = 350;
const TERMO_MINIMO = 2;

/** Busca textual sobre o código-fonte do SIGER® (origem: F:\Fontes), indexado pela
 * ferramenta externa BaseConhecimentoSiger. A cobertura hoje é PARCIAL — a conta de
 * indexação só consegue ler uma fração dos arquivos por restrição de ACL no servidor de
 * arquivos (\\VC-FONTES-VS22\DRIVE-F); o banner de status deixa isso explícito em vez de
 * sugerir uma base completa. */
@Component({
  selector: 'app-base-conhecimento',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './base-conhecimento.component.html',
  styleUrl: './base-conhecimento.component.css',
})
export class BaseConhecimentoComponent {
  private readonly service = inject(BaseConhecimentoService);
  private readonly destroyRef = inject(DestroyRef);
  private debounceId: ReturnType<typeof setTimeout> | null = null;

  readonly termo = signal('');
  readonly buscando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly resultados = signal<ResultadoBuscaSiger[]>(null!);
  readonly jaPesquisou = signal(false);
  readonly status = signal<StatusBaseConhecimentoSiger | null>(null);

  constructor() {
    this.resultados.set([]);
    void this.carregarStatus();
    this.destroyRef.onDestroy(() => {
      if (this.debounceId) clearTimeout(this.debounceId);
    });
  }

  private async carregarStatus(): Promise<void> {
    try {
      this.status.set(await this.service.status());
    } catch {
      // Banner de cobertura é informativo, não crítico — falha silenciosa não impede a busca.
    }
  }

  onTermoAlterado(valor: string): void {
    this.termo.set(valor);
    if (this.debounceId) clearTimeout(this.debounceId);
    if (valor.trim().length < TERMO_MINIMO) {
      this.resultados.set([]);
      this.jaPesquisou.set(false);
      return;
    }
    this.debounceId = setTimeout(() => void this.pesquisar(), DEBOUNCE_MS);
  }

  private async pesquisar(): Promise<void> {
    const termo = this.termo().trim();
    if (termo.length < TERMO_MINIMO) return;
    this.buscando.set(true);
    this.erro.set(null);
    try {
      this.resultados.set(await this.service.pesquisar(termo));
      this.jaPesquisou.set(true);
    } catch {
      this.erro.set('Não foi possível pesquisar agora.');
    } finally {
      this.buscando.set(false);
    }
  }
}
