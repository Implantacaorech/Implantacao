import { Component, computed } from '@angular/core';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { BiIndicadoresAbasComponent } from './bi-indicadores-abas.component';
import { BiIndicadoresFiltrosComponent } from './bi-indicadores-filtros.component';
import { BiIndicadoresBase } from './bi-indicadores.base';

/** **Indicadores de Conclusão** — porte da página homônima do `BI_Interno.pbix`: quantos
 * projetos encerraram por mês, previsto × realizado e quanto tempo levaram (lead-time).
 *
 * "Concluído" é a POSIÇÃO da implantação (`6-…`), não a existência de data de encerramento —
 * há RNS com encerramento PREVISTO preenchido que ainda não concluíram. */
@Component({
  selector: 'app-bi-conclusao',
  standalone: true,
  imports: [ChartDirective, BiIndicadoresAbasComponent, BiIndicadoresFiltrosComponent],
  templateUrl: './bi-conclusao.component.html',
  styleUrls: ['../bi-implantacao/bi-comum.css', './bi-indicadores.css'],
})
export class BiConclusaoComponent extends BiIndicadoresBase {
  readonly concluidos = computed(() => this.linhas().filter((l) => l.concluida));
  readonly porMes = computed(() =>
    this.serie(
      (l) => l.competenciaEncerramento,
      (l) => l.concluida,
    ),
  );

  /** Faixas de lead-time — a média sozinha esconde a dispersão. */
  readonly faixasLeadTime = computed(() => {
    const com = this.concluidos().filter((l) => l.leadTimeMeses !== null);
    const faixas: { chave: string; teste: (m: number) => boolean }[] = [
      { chave: 'até 1 mês', teste: (m) => m <= 1 },
      { chave: '1 a 3 meses', teste: (m) => m > 1 && m <= 3 },
      { chave: '3 a 6 meses', teste: (m) => m > 3 && m <= 6 },
      { chave: '6 a 12 meses', teste: (m) => m > 6 && m <= 12 },
      { chave: 'mais de 12 meses', teste: (m) => m > 12 },
    ];
    return faixas.map((f) => ({
      chave: f.chave,
      quantidade: com.filter((l) => f.teste(l.leadTimeMeses as number)).length,
    }));
  });

  constructor() {
    super();
    void this.carregar();
  }

  readonly graficoConcluidos = computed<ChartConfiguration | null>(() => {
    const d = this.porMes();
    if (d.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: d.map((m) => this.rotuloMes(m.competencia)),
        datasets: [
          {
            label: 'Projetos concluídos',
            data: d.map((m) => m.projetos),
            backgroundColor: '#2e7d32',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } },
      },
    };
  });

  /** Previsto × realizado dos projetos concluídos, com o % de utilização no eixo direito. */
  readonly graficoPrevistoRealizado = computed<ChartConfiguration | null>(() => {
    const d = this.porMes();
    if (d.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: d.map((m) => this.rotuloMes(m.competencia)),
        datasets: [
          {
            label: 'Contratadas',
            data: d.map((m) => m.horasContratadas),
            backgroundColor: '#90a4ae',
          },
          {
            label: 'Realizadas',
            data: d.map((m) => m.horasRealizadas),
            backgroundColor: '#2e7d32',
          },
          {
            label: '% utilização',
            type: 'line',
            yAxisID: 'y2',
            data: d.map((m) => m.percentualUtilizacao),
            borderColor: '#ef6c00',
            backgroundColor: '#ef6c0033',
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'horas' } },
          y2: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: '%' },
          },
        },
      },
    };
  });

  exportarCsv(): void {
    this.baixarCsv(
      `indicadores-conclusao_${this.store.compIni()}_a_${this.store.compFim()}.csv`,
      [
        'RNS', 'Cliente', 'Grupo econômico', 'Responsável', 'Contratação', 'Encerramento',
        'Lead-time (meses)', 'Contratadas', 'Realizadas', '% utilização',
      ],
      this.concluidos().map((l) => [
        l.codigo, l.fantasia, l.grupoEconomico, l.responsavel,
        l.dataContratacao, l.dataEncerramento, l.leadTimeMeses,
        l.horasContratadas, l.horasRealizadas, l.percentualUtilizacao,
      ]),
    );
  }
}
