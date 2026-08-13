import { Component, computed, inject, signal } from '@angular/core';
import { ProntidaoService } from '../../core/services/prontidao.service';
import {
  AchadoProntidao,
  Prontidao,
  Severidade,
  StatusAchado,
} from '../../core/models/prontidao.model';

/** Tela Sistema → Prontidão do Sistema. Mostra a Auditoria de Prontidão dos 9 eixos de forma
 * navegável: veredito por eixo (maturidade 1..5), cartões de contagem, alerta AO VIVO de
 * privacidade da IA e a lista de achados filtrável por severidade e status. Só busca via
 * `ProntidaoService` — nenhum HTTP direto (regra de conformidade). */
@Component({
  selector: 'app-prontidao',
  standalone: true,
  imports: [],
  templateUrl: './prontidao.component.html',
  styleUrl: './prontidao.component.css',
})
export class ProntidaoComponent {
  private readonly service = inject(ProntidaoService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<Prontidao | null>(null);

  /** Filtros da tabela de achados. `null` = todos. */
  readonly filtroSeveridade = signal<Severidade | null>(null);
  readonly filtroStatus = signal<StatusAchado | null>(null);

  readonly rotuloSeveridade: Record<Severidade, string> = {
    critico: 'Crítico',
    alto: 'Alto',
    medio: 'Médio',
    baixo: 'Baixo',
  };
  readonly rotuloStatus: Record<StatusAchado, string> = {
    corrigido: 'Corrigido',
    mitigado: 'Mitigado',
    aberto: 'Aberto',
  };
  readonly ordemSeveridade: Severidade[] = [
    'critico',
    'alto',
    'medio',
    'baixo',
  ];
  readonly ordemStatus: StatusAchado[] = ['corrigido', 'mitigado', 'aberto'];

  /** Achados após aplicar os filtros, já ordenados por severidade (crítico primeiro). */
  readonly achadosFiltrados = computed<AchadoProntidao[]>(() => {
    const d = this.dados();
    if (!d) return [];
    const sev = this.filtroSeveridade();
    const st = this.filtroStatus();
    const peso: Record<Severidade, number> = {
      critico: 0,
      alto: 1,
      medio: 2,
      baixo: 3,
    };
    return d.achados
      .filter((a) => (sev ? a.severidade === sev : true))
      .filter((a) => (st ? a.status === st : true))
      .slice()
      .sort((a, b) => peso[a.severidade] - peso[b.severidade]);
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.dados.set(await this.service.obter());
    } catch {
      this.erro.set('Não foi possível carregar a Prontidão do Sistema.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Alterna um filtro (clicar de novo no mesmo limpa). */
  alternarSeveridade(s: Severidade): void {
    this.filtroSeveridade.set(this.filtroSeveridade() === s ? null : s);
  }
  alternarStatus(s: StatusAchado): void {
    this.filtroStatus.set(this.filtroStatus() === s ? null : s);
  }
  limparFiltros(): void {
    this.filtroSeveridade.set(null);
    this.filtroStatus.set(null);
  }

  /** Segmentos [1..5] para desenhar a barra de maturidade de um eixo. */
  readonly escala = [1, 2, 3, 4, 5];
  nomeEixo(numero: number): string {
    return this.dados()?.eixos.find((e) => e.numero === numero)?.nome ?? '';
  }
}
