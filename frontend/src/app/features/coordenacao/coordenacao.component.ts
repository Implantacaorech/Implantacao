import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { CoordenacaoService } from '../../core/services/coordenacao.service';
import { PainelCoordenacao } from '../../core/models/coordenacao.model';

const CORES_ETAPA = ['#7C3AED', '#003399', '#014980', '#15803D'];
const CORES_SITUACAO: Record<string, string> = {
  'Em andamento': '#003399',
  'Em risco': '#ef4444',
  Pausado: '#94a3b8',
  Concluído: '#22c55e',
};

@Component({
  selector: 'app-coordenacao',
  standalone: true,
  imports: [RouterLink, ChartDirective, DecimalPipe],
  templateUrl: './coordenacao.component.html',
  styleUrl: './coordenacao.component.css',
})
export class CoordenacaoComponent {
  private readonly service = inject(CoordenacaoService);

  readonly carregando = signal(true);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly dados = signal<PainelCoordenacao | null>(null);

  readonly graficoFunil = computed<ChartConfiguration | null>(() => {
    const d = this.dados();
    if (!d) return null;
    return {
      type: 'bar',
      data: {
        labels: [...d.etapas],
        datasets: [
          {
            data: d.etapas.map((e) => d.m.porEtapa[e] ?? 0),
            backgroundColor: CORES_ETAPA,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#E2E8F0' } },
          x: { grid: { display: false } },
        },
      },
    };
  });

  readonly graficoStatus = computed<ChartConfiguration | null>(() => {
    const d = this.dados();
    if (!d) return null;
    return {
      type: 'doughnut',
      data: {
        labels: [...d.situacoes],
        datasets: [
          {
            data: d.situacoes.map((s) => d.m.porSituacao[s] ?? 0),
            backgroundColor: d.situacoes.map((s) => CORES_SITUACAO[s] ?? '#003399'),
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } } },
        cutout: '62%',
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
      this.dados.set(await this.service.coordenacao());
    } catch {
      this.erro.set('Não foi possível carregar o Painel de Coordenação.');
    } finally {
      this.carregando.set(false);
    }
  }

  async enviarDigest(): Promise<void> {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const r = await this.service.enviarDigest();
      if (r.ok) this.aviso.set(r.mensagem);
      else this.erro.set(r.mensagem);
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível enviar o resumo.',
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
