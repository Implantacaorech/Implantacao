import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegadoService } from '../../core/services/legado.service';

@Component({
  selector: 'app-legado-saude',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './saude.component.html',
  styleUrl: './saude.component.css',
})
export class SaudeComponent {
  private readonly service = inject(LegadoService);

  readonly carregando = signal(true);
  readonly ok = signal(false);
  readonly relatorio = signal('');
  readonly erro = signal<string | null>(null);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.saude();
      this.ok.set(r.ok);
      this.relatorio.set(r.relatorio);
    } catch {
      this.erro.set('Não foi possível rodar o verificador.');
    } finally {
      this.carregando.set(false);
    }
  }
}
