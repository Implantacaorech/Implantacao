import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { AuthService } from '../../core/services/auth.service';
import { temPapel } from '../../core/constants/perfis';
import { DashboardsService } from '../../core/services/dashboards.service';
import { BiIndicadoresAbasComponent } from '../bi-indicadores/bi-indicadores-abas.component';
import { DashboardDisponivel, ResultadoDashboard } from '../../core/models/dashboards.model';
import {
  FiltrosSalvos,
  deCampo,
  deSet,
  filtrosSalvos,
} from '../../core/utils/filtros-salvos';

const NOMES_MES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, ChartDirective, BiIndicadoresAbasComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['../bi-implantacao/bi-comum.css', './dashboard.component.css'],
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

  /** Painel de filtros: nasce FECHADO, como nas demais telas do BI — a tela deve abrir
   * mostrando o resultado, não a configuração. */
  readonly filtrosAbertos = signal(false);

  alternarFiltros(): void {
    this.filtrosAbertos.update((v) => !v);
  }

  /** Quantos filtros estão "ativos" em relação ao padrão (tudo marcado = sem filtro).
   * Método comum (não `computed`), porque depende de `situacoesSelecionadas` — um Set
   * mutável, não um signal — e recalcula a cada ciclo de detecção de mudanças, igual a
   * `atalhoAno()` logo abaixo. */
  qtdFiltrosAtivos(): number {
    const total = this.resultado()?.situacoesDisponiveis.length ?? 0;
    const desmarcadas = Math.max(0, total - this.situacoesSelecionadas.size);
    return desmarcadas + (this.mesSel !== null ? 1 : 0);
  }

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

  /** Recorte salvo por usuário logado. São propriedades comuns (e um `Set`), então a gravação
   * é explícita: acontece no início do `carregar()`, antes de o servidor devolver a seleção
   * normalizada — o que se guarda é a escolha da PESSOA, não o eco do backend.
   *
   * `slugAtivo` fica fora: qual dashboard está aberto é a ROTA, e o link é o que se
   * compartilha. */
  private readonly salvos: FiltrosSalvos = filtrosSalvos(
    'bi-implantacao-painel',
    {
      direcao: deCampo(
        () => this.direcao,
        (v) => {
          this.direcao = v;
        },
      ),
      n: deCampo(
        () => this.n,
        (v) => {
          this.n = v;
        },
      ),
      ref: deCampo(
        () => this.ref,
        (v) => {
          this.ref = v;
        },
      ),
      mesSel: deCampo(
        () => this.mesSel,
        (v) => {
          this.mesSel = v;
        },
      ),
      anoSel: deCampo(
        () => this.anoSel,
        (v) => {
          this.anoSel = v;
        },
      ),
      situacoes: deSet(
        () => this.situacoesSelecionadas,
        (v) => {
          this.situacoesSelecionadas = v;
        },
      ),
    },
    { aoRestaurar: () => void this.carregar() },
  );

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
    this.salvos.salvar();
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
    await this.router.navigate(['/bi/implantacao/painel', slug]);
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

  /** Botão "Limpar" da barra de filtros: volta a situação para "todas" (o padrão — nada
   * marcado na URL) e tira o atalho de mês. O PERÍODO fica, como nas demais telas do BI —
   * é o recorte de trabalho, não um filtro de detalhe. */
  limparFiltros(): void {
    this.situacoesSelecionadas = new Set<string>();
    this.mesSel = null;
    this.anoSel = null;
    // Esquece a preferência antes de recarregar: "Limpar" é voltar ao padrão da tela. O
    // período, preservado de propósito, volta a ser gravado pelo `carregar()` abaixo.
    void this.salvos.descartar();
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
