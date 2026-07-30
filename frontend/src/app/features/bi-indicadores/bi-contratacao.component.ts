import { Component, computed } from '@angular/core';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { BiIndicadoresAbasComponent } from './bi-indicadores-abas.component';
import { BiIndicadoresFiltrosComponent } from './bi-indicadores-filtros.component';
import { BiIndicadoresBase } from './bi-indicadores.base';

/** **Indicadores de Contratação** — porte da página homônima do `BI_Interno.pbix`:
 * quantos projetos e clientes entraram por mês e quantas horas foram contratadas,
 * separando cobradas de bonificadas. */
@Component({
  selector: 'app-bi-contratacao',
  standalone: true,
  imports: [ChartDirective, BiIndicadoresAbasComponent, BiIndicadoresFiltrosComponent],
  templateUrl: './bi-contratacao.component.html',
  styleUrls: ['../bi-implantacao/bi-comum.css', './bi-indicadores.css'],
})
export class BiContratacaoComponent extends BiIndicadoresBase {
  readonly porMes = computed(() => this.serie((l) => l.competenciaContratacao));
  readonly porTipo = computed(() => this.contarPor((l) => l.tipoImplantacao));
  readonly porResponsavel = computed(() => this.contarPor((l) => l.responsavel).slice(0, 10));

  constructor() {
    super();
    void this.carregar();
  }

  /** Projetos e clientes novos por mês. */
  readonly graficoVolume = computed<ChartConfiguration | null>(() => {
    const d = this.porMes();
    if (d.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: d.map((m) => this.rotuloMes(m.competencia)),
        datasets: [
          { label: 'Projetos', data: d.map((m) => m.projetos), backgroundColor: '#2196F3' },
          { label: 'Clientes', data: d.map((m) => m.clientes), backgroundColor: '#8b5cf6' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } },
      },
    };
  });

  /** Horas contratadas, separando o que é cobrado do que é bonificado. */
  readonly graficoHoras = computed<ChartConfiguration | null>(() => {
    const d = this.porMes();
    if (d.length === 0) return null;
    return {
      type: 'bar',
      data: {
        labels: d.map((m) => this.rotuloMes(m.competencia)),
        datasets: [
          { label: 'Cobradas', data: d.map((m) => m.horasCobradas), backgroundColor: '#3b82f6' },
          { label: 'Bonificadas', data: d.map((m) => m.horasBonificadas), backgroundColor: '#8b5cf6' },
          {
            label: 'Contratadas (total)', type: 'line',
            data: d.map((m) => m.horasContratadas),
            borderColor: '#1f2937', backgroundColor: '#1f293733', tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'horas' } },
        },
      },
    };
  });

  exportarCsv(): void {
    this.baixarCsv(
      `indicadores-contratacao_${this.store.compIni()}_a_${this.store.compFim()}.csv`,
      ['RNS', 'Cliente', 'Grupo econômico', 'Descrição', 'Responsável', 'Contratação',
       'Posição', 'Tipo', 'Horas contratadas', 'Cobradas', 'Bonificadas'],
      this.linhas().map((l) => [
        l.codigo, l.fantasia, l.grupoEconomico, l.descricao, l.responsavel,
        l.dataContratacao, l.posicao, l.tipoImplantacao,
        l.horasContratadas, l.horasCobradas, l.horasBonificadas,
      ]),
    );
  }
}
