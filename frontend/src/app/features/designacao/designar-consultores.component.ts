import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DesignacaoService } from '../../core/services/designacao.service';
import { ProjetosService } from '../../core/services/projetos.service';

@Component({
  selector: 'app-designar-consultores',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './designar-consultores.component.html',
  styleUrl: './designar-consultores.component.css',
})
export class DesignarConsultoresComponent {
  private readonly service = inject(DesignacaoService);
  private readonly projetos = inject(ProjetosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly modulos = signal<string[]>([]);
  readonly consultores = signal<string[]>([]);
  readonly escolhas = signal<Record<string, string>>({});
  readonly cliente = signal('');
  readonly aplicarATodos = signal('');

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [view, projeto] = await Promise.all([
        this.service.obterConsultores(this.projetoId),
        this.projetos.buscar(this.projetoId),
      ]);
      this.modulos.set(view.modulos);
      this.consultores.set(view.consultores);
      this.escolhas.set({ ...view.atuais });
      this.cliente.set(projeto.cliente);
    } catch {
      this.erro.set('Não foi possível carregar os módulos/consultores.');
    } finally {
      this.carregando.set(false);
    }
  }

  escolhido(modulo: string): string {
    return this.escolhas()[modulo] ?? '';
  }

  escolher(modulo: string, consultor: string): void {
    this.escolhas.set({ ...this.escolhas(), [modulo]: consultor });
  }

  aplicarTodos(): void {
    const nome = this.aplicarATodos();
    const novo: Record<string, string> = {};
    for (const m of this.modulos()) novo[m] = nome;
    this.escolhas.set(novo);
  }

  limparTodos(): void {
    this.aplicarATodos.set('');
    this.escolhas.set({});
  }

  async salvar(): Promise<void> {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      await this.service.designarConsultores(this.projetoId, this.escolhas());
      await this.router.navigate(['/projetos', this.projetoId]);
    } catch (e) {
      const msg =
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível designar os consultores.';
      this.erro.set(msg);
    } finally {
      this.salvando.set(false);
    }
  }
}
