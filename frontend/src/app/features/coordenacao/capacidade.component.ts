import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CoordenacaoService } from '../../core/services/coordenacao.service';
import { ResultadoCapacidade } from '../../core/models/capacidade.model';

@Component({
  selector: 'app-capacidade',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './capacidade.component.html',
  styleUrl: './capacidade.component.css',
})
export class CapacidadeComponent {
  private readonly service = inject(CoordenacaoService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoCapacidade | null>(null);

  modulos = '';
  semanas = 6;

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
}
