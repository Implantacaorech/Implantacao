import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DashboardsService } from '../../core/services/dashboards.service';
import { ResultadoDashboard } from '../../core/models/dashboards.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly service = inject(DashboardsService);
  private readonly route = inject(ActivatedRoute);

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoDashboard | null>(null);

  direcao: 'avancar' | 'recuar' = 'avancar';
  n = 12;
  situacoesSelecionadas = new Set<string>();
  mesSel: number | null = null;
  anoSel: number | null = null;

  readonly colunas = signal<string[]>([]);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.rodar(this.slug, {
        direcao: this.direcao,
        n: this.n,
        situacao: this.situacoesSelecionadas.size > 0 ? [...this.situacoesSelecionadas] : undefined,
        mesSel: this.mesSel ?? undefined,
        anoSel: this.anoSel ?? undefined,
      });
      this.resultado.set(r);
      this.situacoesSelecionadas = new Set(r.situacoesSelecionadas);
      this.colunas.set(r.linhasTabela.length > 0 ? Object.keys(r.linhasTabela[0]) : []);
    } catch {
      this.erro.set('Não foi possível carregar o dashboard.');
    } finally {
      this.carregando.set(false);
    }
  }

  alternarSituacao(situacao: string, marcado: boolean): void {
    if (marcado) this.situacoesSelecionadas.add(situacao);
    else this.situacoesSelecionadas.delete(situacao);
  }

  filtrarMes(mes: number, ano: number): void {
    this.mesSel = this.mesSel === mes && this.anoSel === ano ? null : mes;
    this.anoSel = this.mesSel === null ? null : ano;
    void this.carregar();
  }

  limparFiltroMes(): void {
    this.mesSel = null;
    this.anoSel = null;
    void this.carregar();
  }

  maxValor(valores: number[]): number {
    return valores.length > 0 ? Math.max(...valores) : 0;
  }
}
