import { Component, computed } from '@angular/core';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { BiIndicadoresAbasComponent } from './bi-indicadores-abas.component';
import { BiIndicadoresFiltrosComponent } from './bi-indicadores-filtros.component';
import { BiIndicadoresBase } from './bi-indicadores.base';

/** **% de Utilização das Horas** — porte da página homônima do `BI_Interno.pbix`: quanto das
 * horas contratadas foi de fato consumido, por mês e por projeto, destacando quem estourou. */
@Component({
  selector: 'app-bi-utilizacao',
  standalone: true,
  imports: [ChartDirective, BiIndicadoresAbasComponent, BiIndicadoresFiltrosComponent],
  templateUrl: './bi-utilizacao.component.html',
  styleUrls: ['../bi-implantacao/bi-comum.css', './bi-indicadores.css'],
})
export class BiUtilizacaoComponent extends BiIndicadoresBase {
  readonly porMes = computed(() => this.serie((l) => l.competenciaContratacao));

  /** Só quem tem horas contratadas — sem contratação não existe "% utilizado". */
  readonly comContratacao = computed(() =>
    this.linhas().filter((l) => l.percentualUtilizacao !== null),
  );

  /** Distribuição por faixa de consumo: é o que mostra estouro e subutilização. */
  readonly faixas = computed(() => {
    const l = this.comContratacao();
    const faixas: { chave: string; cor: string; teste: (p: number) => boolean }[] = [
      { chave: 'até 25%', cor: '#10b981', teste: (p) => p <= 25 },
      { chave: '25 a 50%', cor: '#fbbf24', teste: (p) => p > 25 && p <= 50 },
      { chave: '50 a 75%', cor: '#fb923c', teste: (p) => p > 50 && p <= 75 },
      { chave: '75 a 100%', cor: '#ef4444', teste: (p) => p > 75 && p <= 100 },
      { chave: 'acima de 100%', cor: '#1f2937', teste: (p) => p > 100 },
    ];
    return faixas.map((f) => ({
      chave: f.chave,
      cor: f.cor,
      quantidade: l.filter((x) => f.teste(x.percentualUtilizacao as number)).length,
    }));
  });

  readonly estourados = computed(() =>
    this.comContratacao()
      .filter((l) => (l.percentualUtilizacao as number) > 100)
      .sort((a, b) => (b.percentualUtilizacao ?? 0) - (a.percentualUtilizacao ?? 0)),
  );

  constructor() {
    super();
    void this.carregar();
  }

  readonly graficoUtilizacao = computed<ChartConfiguration | null>(() => {
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
            backgroundColor: '#ef4444',
          },
          {
            label: '% utilização',
            type: 'line',
            yAxisID: 'y2',
            data: d.map((m) => m.percentualUtilizacao),
            borderColor: '#1f2937',
            backgroundColor: '#1f293733',
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
      `utilizacao-horas_${this.store.compIni()}_a_${this.store.compFim()}.csv`,
      [
        'RNS', 'Cliente', 'Grupo econômico', 'Responsável', 'Posição',
        'Contratadas', 'Realizadas', 'Saldo', '% utilização',
      ],
      this.comContratacao().map((l) => [
        l.codigo, l.fantasia, l.grupoEconomico, l.responsavel, l.posicao,
        l.horasContratadas, l.horasRealizadas, l.horasSaldo, l.percentualUtilizacao,
      ]),
    );
  }
}
