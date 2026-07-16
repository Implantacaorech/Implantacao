import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigIaService } from '../../core/services/config-ia.service';

@Component({
  selector: 'app-config-ia',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './config-ia.component.html',
  styleUrl: './config-ia.component.css',
})
export class ConfigIaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConfigIaService);

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly ativa = signal(false);
  readonly modelo = signal('');
  readonly viaEnv = signal(false);

  readonly form = this.fb.nonNullable.group({
    apiKey: [''],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const status = await this.service.status();
      this.ativa.set(status.ativa);
      this.modelo.set(status.modelo);
      this.viaEnv.set(status.viaEnv);
    } catch {
      this.erro.set('Não foi possível carregar a configuração de IA.');
    } finally {
      this.carregando.set(false);
    }
  }

  async salvar(): Promise<void> {
    if (this.salvando() || this.viaEnv()) return;
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const status = await this.service.salvar(this.form.getRawValue().apiKey);
      this.ativa.set(status.ativa);
      this.modelo.set(status.modelo);
      this.form.patchValue({ apiKey: '' });
      this.aviso.set(status.ativa ? 'Chave salva.' : 'Chave removida.');
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar a chave.',
      );
    } finally {
      this.salvando.set(false);
    }
  }
}
