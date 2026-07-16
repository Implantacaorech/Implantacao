import { Component, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigGmailService } from '../../core/services/config-gmail.service';

@Component({
  selector: 'app-config-gmail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './config-gmail.component.html',
  styleUrl: './config-gmail.component.css',
})
export class ConfigGmailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ConfigGmailService);

  readonly carregando = signal(true);
  readonly enviando = signal(false);
  readonly autorizando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly temCliente = signal(false);
  readonly autorizado = signal(false);

  constructor() {
    // O Google redireciona de volta para cá após o consentimento (GET /config/gmail/callback
    // no backend redireciona o browser para /config/gmail?autorizado=1 ou ?erro=...).
    const params = this.route.snapshot.queryParamMap;
    if (params.get('autorizado')) this.aviso.set('Gmail API autorizada com sucesso.');
    if (params.get('erro')) this.erro.set(`Falha na autorização: ${params.get('erro')}`);
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const status = await this.service.status();
      this.temCliente.set(status.temCliente);
      this.autorizado.set(status.autorizado);
    } catch {
      this.erro.set('Não foi possível carregar o status da Gmail API.');
    } finally {
      this.carregando.set(false);
    }
  }

  async enviarCliente(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      await this.service.enviarCliente(arquivo);
      this.temCliente.set(true);
      this.aviso.set('Credencial enviada. Agora clique em "Autorizar".');
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível enviar a credencial.',
      );
    } finally {
      this.enviando.set(false);
      input.value = '';
    }
  }

  async autorizar(): Promise<void> {
    this.autorizando.set(true);
    this.erro.set(null);
    try {
      const url = await this.service.urlAutorizacao();
      window.location.href = url;
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível iniciar a autorização.',
      );
      this.autorizando.set(false);
    }
  }
}
