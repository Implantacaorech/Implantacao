import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ETAPAS } from '../../core/models/projeto.model';
import { Paginacao } from '../../core/models/api-envelope.model';
import { Projeto } from '../../core/models/projeto.model';
import { ProjetosService } from '../../core/services/projetos.service';

@Component({
  selector: 'app-projetos-lista',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './projetos-lista.component.html',
  styleUrl: './projetos-lista.component.css',
})
export class ProjetosListaComponent {
  private readonly service = inject(ProjetosService);

  readonly etapas = ETAPAS;
  readonly projetos = signal<Projeto[]>([]);
  readonly paginacao = signal<Paginacao | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  filtroCliente = '';
  filtroEtapa = '';
  pagina = 1;

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const res = await this.service.listar({
        page: this.pagina,
        limit: 20,
        cliente: this.filtroCliente,
        etapa: this.filtroEtapa,
      });
      this.projetos.set(res.data);
      this.paginacao.set(res.pagination ?? null);
    } catch {
      this.erro.set('Não foi possível carregar os projetos.');
    } finally {
      this.carregando.set(false);
    }
  }

  async buscar(): Promise<void> {
    this.pagina = 1;
    await this.carregar();
  }

  async irParaPagina(pagina: number): Promise<void> {
    this.pagina = pagina;
    await this.carregar();
  }

  async excluir(projeto: Projeto): Promise<void> {
    if (!confirm(`Excluir o projeto "${projeto.cliente}"?`)) return;
    await this.service.excluir(projeto.id);
    await this.carregar();
  }
}
