import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ModeloEmailService } from '../../core/services/modelo-email.service';
import { ModeloEmail } from '../../core/models/modelo-email.model';

@Component({
  selector: 'app-modelos-email',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './modelos-email.component.html',
  styleUrl: './modelos-email.component.css',
})
export class ModelosEmailComponent {
  private readonly service = inject(ModeloEmailService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly modelos = signal<ModeloEmail[]>([]);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.modelos.set(await this.service.listar(false));
    } catch {
      this.erro.set('Não foi possível carregar os modelos de e-mail.');
    } finally {
      this.carregando.set(false);
    }
  }

  async alternarAtivo(m: ModeloEmail): Promise<void> {
    try {
      await this.service.alternarAtivo(m.id);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível alterar o status do modelo.'));
    }
  }

  async excluir(m: ModeloEmail): Promise<void> {
    if (!confirm(`Excluir o modelo '${m.nome}'? Esta ação não pode ser desfeita.`)) return;
    try {
      await this.service.excluir(m.id);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível excluir o modelo.'));
    }
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }
}
