import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardsService } from '../../core/services/dashboards.service';
import { DashboardDisponivel } from '../../core/models/dashboards.model';

@Component({
  selector: 'app-dashboards-lista',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboards-lista.component.html',
  styleUrl: './dashboards-lista.component.css',
})
export class DashboardsListaComponent {
  private readonly service = inject(DashboardsService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly itens = signal<DashboardDisponivel[]>([]);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.itens.set(await this.service.listar());
    } catch {
      this.erro.set('Não foi possível carregar os dashboards.');
    } finally {
      this.carregando.set(false);
    }
  }
}
