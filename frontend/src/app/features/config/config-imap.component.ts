import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigImapService } from '../../core/services/config-imap.service';

@Component({
  selector: 'app-config-imap',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './config-imap.component.html',
  styleUrl: './config-imap.component.css',
})
export class ConfigImapComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConfigImapService);

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly configurado = signal(false);

  readonly form = this.fb.nonNullable.group({
    host: [''],
    port: ['993'],
    user: [''],
    pasta: ['INBOX'],
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
      this.erro.set('Não foi possível carregar a configuração de IMAP.');
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
      this.aviso.set(status.configurado ? 'Salvo. Pronto para checar a caixa.' : 'Salvo.');
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
