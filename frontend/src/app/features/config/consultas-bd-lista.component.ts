import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsultaBdService } from '../../core/services/consulta-bd.service';
import { ConsultaBD } from '../../core/models/consulta-bd.model';

@Component({
  selector: 'app-consultas-bd-lista',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './consultas-bd-lista.component.html',
  styleUrl: './consultas-bd-lista.component.css',
})
export class ConsultasBdListaComponent {
  private readonly service = inject(ConsultaBdService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly itens = signal<ConsultaBD[]>([]);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.itens.set(await this.service.listar());
    } catch {
      this.erro.set('Não foi possível carregar as consultas.');
    } finally {
      this.carregando.set(false);
    }
  }

  async excluir(slug: string): Promise<void> {
    if (!confirm('Excluir esta consulta salva?')) return;
    try {
      await this.service.excluir(slug);
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível excluir a consulta.');
    }
  }
}
