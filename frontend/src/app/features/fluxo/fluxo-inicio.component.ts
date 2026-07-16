import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FluxoService } from '../../core/services/fluxo.service';
import { EstadoFluxoConfirmar } from '../../core/models/fluxo.model';

@Component({
  selector: 'app-fluxo-inicio',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './fluxo-inicio.component.html',
  styleUrl: './fluxo-inicio.component.css',
})
export class FluxoInicioComponent {
  private readonly service = inject(FluxoService);
  private readonly router = inject(Router);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly checando = signal(false);
  readonly extraindo = signal(false);
  readonly imapOk = signal(false);
  readonly smtpOk = signal(false);
  readonly modelo = signal('');

  texto = '';

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const r = await this.service.status();
      this.imapOk.set(r.imapConfigurado);
      this.smtpOk.set(r.smtpConfigurado);
      this.modelo.set(r.modeloFechamento);
    } catch {
      this.erro.set('Não foi possível carregar o status do fluxo.');
    } finally {
      this.carregando.set(false);
    }
  }

  copiarModelo(): void {
    void navigator.clipboard.writeText(this.modelo());
  }

  async checarCaixa(): Promise<void> {
    this.checando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.inbox();
      if (!r.encontrado || !r.campos) {
        this.erro.set(r.erro || 'Nenhum e-mail de fechamento encontrado na caixa de entrada.');
        return;
      }
      await this.irParaConfirmar({ campos: r.campos, fonte: 'caixa de entrada', assunto: r.assunto });
    } catch {
      this.erro.set('Não foi possível checar a caixa de entrada.');
    } finally {
      this.checando.set(false);
    }
  }

  async extrairTexto(): Promise<void> {
    if (!this.texto.trim()) return;
    this.extraindo.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.parse(this.texto);
      await this.irParaConfirmar({ campos: r.campos, fonte: 'e-mail colado' });
    } catch {
      this.erro.set('Não foi possível extrair os dados do texto colado.');
    } finally {
      this.extraindo.set(false);
    }
  }

  private async irParaConfirmar(estado: EstadoFluxoConfirmar): Promise<void> {
    await this.router.navigate(['/fluxo/confirmar'], { state: estado });
  }
}
