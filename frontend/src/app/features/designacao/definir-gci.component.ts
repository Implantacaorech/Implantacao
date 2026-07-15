import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DesignacaoService } from '../../core/services/designacao.service';

@Component({
  selector: 'app-definir-gci',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './definir-gci.component.html',
  styleUrl: './definir-gci.component.css',
})
export class DefinirGciComponent {
  private readonly service = inject(DesignacaoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly gcis = signal<string[]>([]);
  readonly selecionados = signal<string[]>([]);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const view = await this.service.obterDefinirGci(this.projetoId);
      this.gcis.set(view.gcis);
      this.selecionados.set(
        view.gciAtual
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean),
      );
    } catch {
      this.erro.set('Não foi possível carregar os dados do GCI.');
    } finally {
      this.carregando.set(false);
    }
  }

  marcado(nome: string): boolean {
    return this.selecionados().includes(nome);
  }

  alternar(nome: string, marcado: boolean): void {
    const atual = new Set(this.selecionados());
    if (marcado) atual.add(nome);
    else atual.delete(nome);
    this.selecionados.set([...atual]);
  }

  async salvar(): Promise<void> {
    if (this.selecionados().length === 0 || this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      await this.service.definirGci(this.projetoId, this.selecionados());
      await this.router.navigate(['/projetos', this.projetoId]);
    } catch (e) {
      const msg =
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar o(s) GCI(s).';
      this.erro.set(msg);
    } finally {
      this.salvando.set(false);
    }
  }
}
