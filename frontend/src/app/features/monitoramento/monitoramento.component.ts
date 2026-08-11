import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { AtividadeService } from '../../core/services/atividade.service';
import { ResultadoMonitoramento } from '../../core/models/monitoramento.model';
import { ROTULO_NIVEL, ResultadoSaude } from '../../core/models/saude.model';
import { SaudeService } from '../../core/services/saude.service';
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
  private readonly saudeService = inject(SaudeService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<ResultadoMonitoramento | null>(null);

  /** Saúde da INFRAESTRUTURA — backup, Guardião, docservice, banco, e-mail. Separada do
   * `d.saude` do painel, que é o percentual de projetos saudáveis (negócio, não máquina).
   *
   * Carrega por conta própria, e não junto com o resto: uma das checagens é bater no
   * docservice, que quando está fora do ar só responde no timeout — e é justamente aí que
   * ela mais importa. Prender a tela inteira nisso seria deixar o Monitoramento lento
   * exatamente no dia do incidente. */
  readonly saude = signal<ResultadoSaude | null>(null);
  readonly saudeIndisponivel = signal(false);
  readonly rotuloNivel = ROTULO_NIVEL;

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
        // Igual aos gráficos de Coordenação/Dashboards: a altura vem do container (wrapper
        // com height fixo), senão o Chart.js ignora o height do canvas e cresce pela largura.
        maintainAspectRatio: false,
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
    void this.carregarSaude();
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

  async carregarSaude(): Promise<void> {
    this.saudeIndisponivel.set(false);
    try {
      this.saude.set(await this.saudeService.diagnostico());
    } catch {
      // Sem erro na tela toda: o diagnóstico é um bloco a mais, e o Monitoramento continua
      // útil sem ele.
      this.saudeIndisponivel.set(true);
    }
  }
}
