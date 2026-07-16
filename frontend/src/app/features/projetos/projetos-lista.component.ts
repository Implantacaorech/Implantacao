import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ETAPAS, SITUACOES, Projeto } from '../../core/models/projeto.model';
import { ProjetosService } from '../../core/services/projetos.service';
import { AuthService } from '../../core/services/auth.service';

type Vista = 'kanban' | 'tabela';

const FASE_CLS: Record<string, string> = {
  Levantamento: 'fase-1',
  Projeto: 'fase-2',
  'Cronograma e Check-list': 'fase-3',
  Encerramento: 'fase-4',
};

@Component({
  selector: 'app-projetos-lista',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './projetos-lista.component.html',
  styleUrl: './projetos-lista.component.css',
})
export class ProjetosListaComponent {
  private readonly service = inject(ProjetosService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly etapas = ETAPAS;
  readonly situacoes = SITUACOES;
  readonly faseCls = FASE_CLS;

  readonly todos = signal<Projeto[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly vista = signal<Vista>('kanban');

  busca = '';
  fstatus = '';
  fetapa = '';

  readonly filtrados = computed(() => {
    const q = this.busca.trim().toLowerCase();
    return this.todos().filter(
      (p) =>
        (!q || p.cliente.toLowerCase().includes(q)) &&
        (!this.fstatus || p.situacao === this.fstatus) &&
        (!this.fetapa || p.etapa === this.fetapa),
    );
  });

  readonly porEtapa = computed(() => {
    const grupos = new Map<string, Projeto[]>();
    for (const e of this.etapas) grupos.set(e, []);
    for (const p of this.filtrados()) grupos.get(p.etapa)?.push(p);
    return grupos;
  });

  readonly perfilNomeConsultor = computed(() => {
    const u = this.auth.usuario();
    return u?.perfil === 'Consultor' ? u.nome : null;
  });

  constructor() {
    const v = (localStorage.getItem('vista_carteira') as Vista | null) ?? 'kanban';
    this.vista.set(v);
    this.busca = this.route.snapshot.queryParamMap.get('q') ?? '';
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const res = await this.service.listar({ page: 1, limit: 1000 });
      this.todos.set(res.data);
    } catch {
      this.erro.set('Não foi possível carregar os projetos.');
    } finally {
      this.carregando.set(false);
    }
  }

  setVista(v: Vista): void {
    this.vista.set(v);
    localStorage.setItem('vista_carteira', v);
  }

  async excluir(projeto: Projeto): Promise<void> {
    if (!confirm(`Excluir o projeto "${projeto.cliente}"?`)) return;
    await this.service.excluir(projeto.id);
    await this.carregar();
  }
}
