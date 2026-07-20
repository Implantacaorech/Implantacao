import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { AtividadeService } from '../../core/services/atividade.service';
import { ResultadoMonitoramento } from '../../core/models/monitoramento.model';
import { AgentesGrafoComponent } from './agentes-grafo/agentes-grafo.component';

@Component({
  selector: 'app-monitoramento',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, ChartDirective, AgentesGrafoComponent],
  templateUrl: './monitoramento.component.html',
  styleUrl: './monitoramento.component.css',
})
export class MonitoramentoComponent {
  private readonly service = inject(AtividadeService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<ResultadoMonitoramento | null>(null);

  readonly graficoSetores = computed<ChartConfiguration | null>(() => {
    const d = this.dados();
    if (!d) return null;
    return {
      type: 'bar',
      data: {
        labels: d.chartSetores.labels,
        datasets: [
          { label: 'Andamento', data: d.chartSetores.andamento, backgroundColor: '#2563EB', borderRadius: 6, borderSkipped: false },
          { label: 'Pendentes', data: d.chartSetores.pendentes, backgroundColor: '#F59E0B', borderRadius: 6, borderSkipped: false },
          { label: 'Atrasadas', data: d.chartSetores.atrasadas, backgroundColor: '#B42318', borderRadius: 6, borderSkipped: false },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#E2E8F0' } },
        },
      },
    };
  });

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
