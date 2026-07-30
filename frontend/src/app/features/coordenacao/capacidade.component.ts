import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CoordenacaoService } from '../../core/services/coordenacao.service';
import {
  LinhaCapacidade,
  ResultadoCapacidade,
  SETOR_SEM,
} from '../../core/models/capacidade.model';
import { deSignal, filtrosSalvos } from '../../core/utils/filtros-salvos';

@Component({
  selector: 'app-capacidade',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './capacidade.component.html',
  styleUrl: './capacidade.component.css',
})
export class CapacidadeComponent {
  private readonly service = inject(CoordenacaoService);

  readonly janelasSemanas = [4, 6, 8, 12];
  readonly setorSem = SETOR_SEM;

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoCapacidade | null>(null);

  // SIGNALS, não campos comuns: os `computed` abaixo (e a gravação da preferência) só
  // reagem a signal. Como campo simples, `filtro()` era calculado uma única vez e ficava
  // preso no valor inicial — o bloco "Resposta ao Comercial" e a coluna de notas por módulo
  // nunca apareciam, por mais que se digitasse na busca.
  readonly modulos = signal('');
  readonly semanas = signal(6);
  /** '' = todos os setores · `SETOR_SEM` = só quem está sem setor no cadastro. */
  readonly setor = signal('');

  readonly filtro = computed(() => this.modulos().trim());

  /** Opções do select de setor. Vem do RESULTADO (a lista completa da equipe, calculada no
   * backend antes de aplicar o filtro), por isso não se fecha ao escolher um setor. */
  readonly setores = computed(() => this.resultado()?.setoresDisponiveis ?? []);
  readonly temSemSetor = computed(() => (this.resultado()?.semSetor ?? 0) > 0);

  /** Rótulo do setor em uso, para as mensagens da tela. */
  readonly setorAtivo = computed(() => {
    const s = this.setor();
    if (!s) return '';
    return s === SETOR_SEM ? 'sem setor no cadastro' : s;
  });

  readonly aptos = computed<LinhaCapacidade[]>(
    () => this.resultado()?.equipe.filter((t) => t.veredito === 'Pronto') ?? [],
  );

  constructor() {
    // Filtros guardados por usuário logado: a tela reabre no recorte que a pessoa deixou.
    // Vem ANTES do carregar() — a restauração é síncrona, então a primeira avaliação já sai
    // com os módulos/setor/janela salvos, sem uma consulta jogada fora.
    filtrosSalvos(
      'capacidade',
      {
        modulos: deSignal(this.modulos),
        semanas: deSignal(this.semanas),
        setor: deSignal(this.setor),
      },
      { aoRestaurar: () => void this.carregar() },
    );
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.resultado.set(
        await this.service.capacidade(
          this.modulos(),
          this.semanas(),
          this.setor(),
        ),
      );
    } catch {
      this.erro.set('Não foi possível carregar a capacidade da equipe.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Os SELECTS (setor e janela) filtram na hora — é escolha discreta, sem digitação, e é
   * assim que os filtros se comportam nas demais telas. O campo de módulos, por ser texto,
   * continua esperando o "Avaliar". */
  trocarSetor(valor: string): void {
    this.setor.set(valor);
    void this.carregar();
  }

  trocarSemanas(valor: string | number): void {
    this.semanas.set(Number(valor) || 6);
    void this.carregar();
  }

  formataData(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—';
  }

  notasModulos(t: LinhaCapacidade): { modulo: string; nota: number }[] {
    return Object.entries(t.notasModulos).map(([modulo, nota]) => ({ modulo, nota }));
  }

  clientesDe(t: LinhaCapacidade): string {
    return t.projetos.map((p) => p.cliente).join(', ');
  }
}
