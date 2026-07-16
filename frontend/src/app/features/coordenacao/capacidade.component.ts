import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CoordenacaoService } from '../../core/services/coordenacao.service';
import { LinhaCapacidade, ResultadoCapacidade } from '../../core/models/capacidade.model';

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

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoCapacidade | null>(null);

  modulos = '';
  semanas = 6;

  readonly filtro = computed(() => this.modulos.trim());

  readonly aptos = computed<LinhaCapacidade[]>(
    () => this.resultado()?.equipe.filter((t) => t.veredito === 'Pronto') ?? [],
  );

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.resultado.set(await this.service.capacidade(this.modulos, this.semanas));
    } catch {
      this.erro.set('Não foi possível carregar a capacidade da equipe.');
    } finally {
      this.carregando.set(false);
    }
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
