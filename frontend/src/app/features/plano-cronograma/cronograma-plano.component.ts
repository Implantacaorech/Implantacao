import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PlanoCronogramaService } from '../../core/services/plano-cronograma.service';
import { CRONO_STATUS, LinhaCronograma, Modificacao } from '../../core/models/plano-cronograma.model';

function linhaVazia(): LinhaCronograma {
  return { etapa: '', topicos: '', horas: '', data: '', modalidade: '', status: 'Previsto' };
}

@Component({
  selector: 'app-cronograma-plano',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './cronograma-plano.component.html',
  styleUrl: './cronograma-plano.component.css',
})
export class CronogramaPlanoComponent {
  private readonly service = inject(PlanoCronogramaService);
  private readonly route = inject(ActivatedRoute);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));
  readonly statusOpcoes = CRONO_STATUS;

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly semeando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly linhas = signal<LinhaCronograma[]>([]);
  readonly historico = signal<Modificacao[]>([]);
  readonly mostrarHistorico = signal(false);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const { itens, historico } = await this.service.obterCronograma(this.projetoId);
      this.linhas.set(
        itens.map((i) => ({
          etapa: i.etapa,
          topicos: i.topicos,
          horas: i.horas,
          data: i.data,
          modalidade: i.modalidade,
          status: i.status,
        })),
      );
      this.historico.set(historico);
    } catch {
      this.erro.set('Não foi possível carregar o cronograma.');
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

  atualizarCampo<K extends keyof LinhaCronograma>(indice: number, campo: K, valor: LinhaCronograma[K]): void {
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
      const { mudancas } = await this.service.salvarCronograma(this.projetoId, this.linhas());
      this.aviso.set(`Cronograma salvo (${mudancas} alteração(ões)).`);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar o cronograma.'));
    } finally {
      this.salvando.set(false);
    }
  }

  async carregarPlanoAutomatico(): Promise<void> {
    if (this.semeando()) return;
    if (!confirm('Isso substitui TODAS as linhas atuais pelo plano automático. Continuar?')) return;
    this.semeando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const { mudancas } = await this.service.seedCronograma(this.projetoId);
      this.aviso.set(`Plano automático carregado (${mudancas} alteração(ões)).`);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível carregar o plano automático.'));
    } finally {
      this.semeando.set(false);
    }
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }
}
