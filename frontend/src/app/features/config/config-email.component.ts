import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigEmailService } from '../../core/services/config-email.service';

@Component({
  selector: 'app-config-email',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './config-email.component.html',
  styleUrl: './config-email.component.css',
})
export class ConfigEmailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConfigEmailService);

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly configurado = signal(false);

  readonly form = this.fb.nonNullable.group({
    host: [''],
    port: ['587'],
    user: [''],
    remetente: [''],
    useTls: [true],
    senha: [''],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const status = await this.service.status();
      this.form.patchValue({ ...status, senha: '' });
      this.configurado.set(status.configurado);
    } catch {
      this.erro.set('Não foi possível carregar a configuração de E-mail.');
    } finally {
      this.carregando.set(false);
    }
  }

  async salvar(): Promise<void> {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const dados = this.form.getRawValue();
      const dto = { ...dados };
      if (!dto.senha) delete (dto as Partial<typeof dados>).senha;
      const status = await this.service.salvar(dto);
      this.configurado.set(status.configurado);
      this.form.patchValue({ senha: '' });
      this.aviso.set(status.configurado ? 'Configuração salva. Pronto para enviar.' : 'Configuração salva.');
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar a configuração.',
      );
    } finally {
      this.salvando.set(false);
    }
  }
}
