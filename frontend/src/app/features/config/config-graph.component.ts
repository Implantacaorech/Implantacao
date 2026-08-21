import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigGraphService } from '../../core/services/config-graph.service';

/** Config → E-mail (Microsoft 365). Gêmea da ConfigEmailComponent, com uma diferença: aqui
 * não há host/porta/TLS — o envio é pela API do Graph, sobre HTTPS. Os quatro campos são os
 * que o TI entrega ao criar o registro de aplicativo no Entra ID. */
@Component({
  selector: 'app-config-graph',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './config-graph.component.html',
  styleUrl: './config-graph.component.css',
})
export class ConfigGraphComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConfigGraphService);

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly configurado = signal(false);
  readonly temSegredo = signal(false);

  readonly form = this.fb.nonNullable.group({
    tenantId: [''],
    clientId: [''],
    remetente: [''],
    clientSecret: [''],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const status = await this.service.status();
      this.form.patchValue({ ...status, clientSecret: '' });
      this.configurado.set(status.configurado);
      this.temSegredo.set(status.temSegredo);
    } catch {
      this.erro.set('Não foi possível carregar a configuração do Microsoft 365.');
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
      // Campo em branco = manter o segredo atual (o backend nunca devolve o valor para
      // reexibir). Mesmo contrato da senha em Config → E-mail.
      if (!dto.clientSecret) delete (dto as Partial<typeof dados>).clientSecret;
      const status = await this.service.salvar(dto);
      this.configurado.set(status.configurado);
      this.temSegredo.set(status.temSegredo);
      this.form.patchValue({ clientSecret: '' });
      this.aviso.set(
        status.configurado ? 'Configuração salva. Pronto para enviar.' : 'Configuração salva.',
      );
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
