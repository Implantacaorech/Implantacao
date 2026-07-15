import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AtividadeService } from '../../core/services/atividade.service';
import { ResultadoMonitoramento } from '../../core/models/monitoramento.model';

@Component({
  selector: 'app-monitoramento',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './monitoramento.component.html',
  styleUrl: './monitoramento.component.css',
})
export class MonitoramentoComponent {
  private readonly service = inject(AtividadeService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<ResultadoMonitoramento | null>(null);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.dados.set(await this.service.monitoramento());
    } catch {
      this.erro.set('Não foi possível carregar o Monitoramento Operacional.');
    } finally {
      this.carregando.set(false);
    }
  }
}
