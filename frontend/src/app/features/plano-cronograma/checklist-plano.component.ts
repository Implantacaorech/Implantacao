import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PlanoCronogramaService } from '../../core/services/plano-cronograma.service';
import { CHECK_STATUS, LinhaChecklist, Modificacao } from '../../core/models/plano-cronograma.model';

function linhaVazia(): LinhaChecklist {
  return { modulo: '', item: '', responsavel: '', status: 'Pendente', obs: '' };
}

@Component({
  selector: 'app-checklist-plano',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './checklist-plano.component.html',
  styleUrl: './checklist-plano.component.css',
})
export class ChecklistPlanoComponent {
  private readonly service = inject(PlanoCronogramaService);
  private readonly route = inject(ActivatedRoute);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));
  readonly statusOpcoes = CHECK_STATUS;

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly semeando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly linhas = signal<LinhaChecklist[]>([]);
  readonly historico = signal<Modificacao[]>([]);

  readonly concluidos = computed(() => this.linhas().filter((l) => l.status === 'Concluído').length);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const { itens, historico } = await this.service.obterChecklist(this.projetoId);
      this.linhas.set(
        itens.map((i) => ({
          modulo: i.modulo,
          item: i.item,
          responsavel: i.responsavel,
          status: i.status,
          obs: i.obs,
        })),
      );
      this.historico.set(historico);
    } catch {
      this.erro.set('Não foi possível carregar o check list.');
    } finally {
      this.carregando.set(false);
    }
  }

  adicionarLinha(): void {
    this.linhas.set([...this.linhas(), linhaVazia()]);
  }

  removerLinha(indice: number): void {
    this.linhas.set(this.linhas().filter((_, i) => i !== indice));
  }

  moverLinha(indice: number, delta: number): void {
    const destino = indice + delta;
    const copia = [...this.linhas()];
    if (destino < 0 || destino >= copia.length) return;
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    this.linhas.set(copia);
  }

  atualizarCampo<K extends keyof LinhaChecklist>(indice: number, campo: K, valor: LinhaChecklist[K]): void {
    const copia = [...this.linhas()];
    copia[indice] = { ...copia[indice], [campo]: valor };
    this.linhas.set(copia);
  }

  async salvar(): Promise<void> {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const { mudancas } = await this.service.salvarChecklist(this.projetoId, this.linhas());
      this.aviso.set(`Check list salvo (${mudancas} alteração(ões)).`);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar o check list.'));
    } finally {
      this.salvando.set(false);
    }
  }

  async carregarRoteiro(): Promise<void> {
    if (this.semeando()) return;
    if (!confirm('Isso substitui TODOS os itens atuais pelo roteiro dos módulos. Continuar?')) return;
    this.semeando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const { mudancas } = await this.service.seedChecklist(this.projetoId);
      this.aviso.set(`Roteiro dos módulos carregado (${mudancas} alteração(ões)).`);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível carregar o roteiro dos módulos.'));
    } finally {
      this.semeando.set(false);
    }
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }
}
