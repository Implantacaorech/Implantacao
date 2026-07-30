import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatrizService } from '../../core/services/matriz.service';
import { MatrizTecnicoComContagem } from '../../core/models/matriz.model';
import { deSignal, filtrosSalvos } from '../../core/utils/filtros-salvos';

@Component({
  selector: 'app-matriz-lista',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './matriz-lista.component.html',
  styleUrl: './matriz-lista.component.css',
})
export class MatrizListaComponent {
  private readonly service = inject(MatrizService);
  private readonly router = inject(Router);

  readonly carregando = signal(true);
  readonly importando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly itens = signal<MatrizTecnicoComContagem[]>([]);
  readonly restrito = signal(false);
  readonly podeAdmin = signal(false);
  readonly filtro = signal('');

  readonly itensFiltrados = computed(() => {
    const f = this.filtro().trim().toLowerCase();
    if (!f) return this.itens();
    return this.itens().filter((t) => `${t.nome} ${t.setor}`.toLowerCase().includes(f));
  });

  constructor() {
    // Filtro salvo por usuário logado. Filtra em memória, então não há o que recarregar
    // quando a preferência chega — o `computed` reage sozinho.
    filtrosSalvos('matriz', { filtro: deSignal(this.filtro) });
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const view = await this.service.listar();
      if (view.redirecionarParaId) {
        await this.router.navigate(['/matriz', view.redirecionarParaId]);
        return;
      }
      this.itens.set(view.itens);
      this.restrito.set(view.restrito);
      this.podeAdmin.set(!!view.podeAdmin);
    } catch {
      this.erro.set('Não foi possível carregar a Matriz de Conhecimento.');
    } finally {
      this.carregando.set(false);
    }
  }

  async importar(): Promise<void> {
    if (this.importando()) return;
    this.importando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const r = await this.service.importar();
      if (r.ok) this.aviso.set(r.mensagem);
      else this.erro.set(r.mensagem);
      await this.carregar();
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível importar a planilha.',
      );
    } finally {
      this.importando.set(false);
    }
  }
}
