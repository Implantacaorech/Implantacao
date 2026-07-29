import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { AuthService } from '../../core/services/auth.service';
import { temPapel } from '../../core/constants/perfis';
import { DashboardsService } from '../../core/services/dashboards.service';
import { BiAbasPrincipaisComponent } from '../bi-implantacao/bi-abas-principais.component';
import { DashboardDisponivel, ResultadoDashboard } from '../../core/models/dashboards.model';

const NOMES_MES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, ChartDirective, BiAbasPrincipaisComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly service = inject(DashboardsService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly nomesMes = NOMES_MES;
  readonly ehAdm = computed(() => temPapel(this.auth.usuario(), 'ADM'));

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dashboards = signal<DashboardDisponivel[]>([]);
  readonly resultado = signal<ResultadoDashboard | null>(null);
  readonly slugAtivo = signal('');

  direcao: 'avancar' | 'recuar' = 'avancar';
  n = 12;
  ref = '';
  situacoesSelecionadas = new Set<string>();
  mesSel: number | null = null;
  anoSel: number | null = null;

  readonly colunas = computed(() => {
    const linhas = this.resultado()?.linhasTabela ?? [];
    return linhas.length > 0 ? Object.keys(linhas[0]) : [];
  });

  // A "Previsão Início Oficial" (única existente hoje) devolve as colunas cruas do Oracle
  // (CODIGO/CLIENTE/DESCRICAO/DATA_CONTRATACAO/PREVISAO_INICIO_OFICIAL/SITUACAO/RESPONSAVEL) —
  // aqui remontamos a mesma tabela de 5 colunas formatada do webapp/routes_dashboards.py; para
  // qualquer outro dashboard futuro (colunas diferentes), cai no fallback genérico por coluna.
  readonly linhasPrevisaoInicio = computed<{ rns: string; dataContratacao: string; previsaoInicioOficial: string; situacao: string; responsavel: string }[] | null>(() => {
    const linhas = this.resultado()?.linhasTabela ?? [];
    if (linhas.length === 0) return null;
    const chaves = new Set(Object.keys(linhas[0]).map((k) => k.toUpperCase()));
    const esperadas = ['CODIGO', 'CLIENTE', 'DESCRICAO', 'DATA_CONTRATACAO', 'PREVISAO_INICIO_OFICIAL', 'SITUACAO', 'RESPONSAVEL'];
    if (!esperadas.every((k) => chaves.has(k))) return null;
    const valor = (l: Record<string, unknown>, k: string): string => {
      const chave = Object.keys(l).find((x) => x.toUpperCase() === k);
      return chave ? String(l[chave] ?? '').trim() : '';
    };
    const dataBr = (v: string): string => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '');
    return linhas.map((l) => ({
      rns: `${valor(l, 'CODIGO')}-${valor(l, 'CLIENTE')} - ${valor(l, 'DESCRICAO')}`,
      dataContratacao: dataBr(valor(l, 'DATA_CONTRATACAO')),
      previsaoInicioOficial: dataBr(valor(l, 'PREVISAO_INICIO_OFICIAL')),
      situacao: valor(l, 'SITUACAO'),
      responsavel: valor(l, 'RESPONSAVEL'),
    }));
  });

  constructor() {
    void this.carregarTudo();
  }

  async carregarTudo(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const itens = await this.service.listar();
      this.dashboards.set(itens);
      const slugRota = this.route.snapshot.paramMap.get('slug');
      const slug = slugRota || itens[0]?.slug || '';
      this.slugAtivo.set(slug);
      if (slug) await this.carregar();
    } catch {
      this.erro.set('Não foi possível carregar os dashboards.');
    } finally {
      this.carregando.set(false);
    }
  }

  async carregar(): Promise<void> {
    if (!this.slugAtivo()) return;
    this.erro.set(null);
    try {
      const r = await this.service.rodar(this.slugAtivo(), {
        ref: this.ref || undefined,
        direcao: this.direcao,
        n: this.n,
        situacao: this.situacoesSelecionadas.size > 0 ? [...this.situacoesSelecionadas] : undefined,
        mesSel: this.mesSel ?? undefined,
        anoSel: this.anoSel ?? undefined,
      });
      this.resultado.set(r);
      this.situacoesSelecionadas = new Set(r.situacoesSelecionadas);
      this.ref = r.periodo.ref.slice(0, 7);
    } catch {
      this.erro.set('Não foi possível carregar o dashboard.');
    }
  }

  async trocarAba(slug: string): Promise<void> {
    if (slug === this.slugAtivo()) return;
    this.slugAtivo.set(slug);
    this.mesSel = null;
    this.anoSel = null;
    await this.router.navigate(['/bi/implantacao', slug]);
    await this.carregar();
  }

  alternarSituacao(situacao: string, marcado: boolean): void {
    if (marcado) this.situacoesSelecionadas.add(situacao);
    else this.situacoesSelecionadas.delete(situacao);
    void this.carregar();
  }

  selecionarMes(mes: number, ano: number): void {
    this.mesSel = mes;
    this.anoSel = ano;
    void this.carregar();
  }

  limparFiltroMes(): void {
    this.mesSel = null;
    this.anoSel = null;
    void this.carregar();
  }

  atalhoAno(mes: number): number | null {
    return this.resultado()?.atalhos[mes] ?? null;
  }

  readonly grafico = computed<ChartConfiguration | null>(() => {
    const g = this.resultado()?.grafico;
    if (!g) return null;
    return {
      type: 'bar',
      data: { labels: g.labels, datasets: [{ label: 'Clientes', data: g.valores, backgroundColor: '#7c9885' }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    };
  });
}
