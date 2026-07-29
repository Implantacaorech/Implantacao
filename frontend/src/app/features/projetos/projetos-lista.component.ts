import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ETAPAS, SITUACOES, Projeto } from '../../core/models/projeto.model';
import { ProjetosService } from '../../core/services/projetos.service';
import { PassosService } from '../../core/services/passos.service';
import {
  GradeView,
  PassoAtualDoProjeto,
  StatusFase,
} from '../../core/models/passo.model';
import { AuthService } from '../../core/services/auth.service';
import { temPapel } from '../../core/constants/perfis';

type Vista = 'kanban' | 'tabela' | 'grade';

/** Rótulo de cada status na Grade. */
const ROTULO_STATUS: Record<StatusFase, string> = {
  realizado: 'Realizado',
  andamento: 'Em andamento',
  nao: 'Não realizado',
};

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
  private readonly passosService = inject(PassosService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly etapas = ETAPAS;
  readonly situacoes = SITUACOES;
  readonly faseCls = FASE_CLS;

  readonly todos = signal<Projeto[]>([]);
  /** Passo atual de cada projeto, por id — é o que define a coluna do quadro. */
  readonly passoPorProjeto = signal<Map<number, PassoAtualDoProjeto>>(new Map());
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly vista = signal<Vista>('kanban');

  // Grade Cliente × fases (carregada sob demanda ao abrir a visão em grade).
  readonly grade = signal<GradeView | null>(null);
  readonly carregandoGrade = signal(false);
  readonly rotuloStatus = ROTULO_STATUS;

  // Filtros da página — SIGNALS (não campos comuns): os `computed` abaixo só reagem se as
  // dependências forem signals. Como campos simples, a busca/status/fase eram ignorados.
  readonly busca = signal('');
  readonly fstatus = signal('');
  readonly fetapa = signal('');

  /** Colunas da grade (as fases do processo). */
  readonly gradePassos = computed(() => this.grade()?.passos ?? []);

  /** Fases agrupadas por macro-etapa (colspan do cabeçalho da grade). */
  readonly gradeGrupos = computed(() => {
    const grupos: { etapa: string; passos: GradeView['passos'] }[] = [];
    for (const p of this.gradePassos()) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.etapa === p.etapa) ultimo.passos.push(p);
      else grupos.push({ etapa: p.etapa, passos: [p] });
    }
    return grupos;
  });

  /** Linhas da grade (um projeto cada), respeitando o filtro de busca por cliente. */
  readonly gradeLinhas = computed(() => {
    const g = this.grade();
    if (!g) return [];
    const q = this.busca().trim().toLowerCase();
    return q
      ? g.linhas.filter((l) => l.cliente.toLowerCase().includes(q))
      : g.linhas;
  });

  readonly filtrados = computed(() => {
    const q = this.busca().trim().toLowerCase();
    const st = this.fstatus();
    const et = this.fetapa();
    return this.todos().filter(
      (p) =>
        (!q || p.cliente.toLowerCase().includes(q)) &&
        (!st || p.situacao === st) &&
        (!et || p.etapa === et),
    );
  });

  /** Progresso de um projeto na grade: fases realizadas / total. */
  gradeProgresso(linha: GradeView['linhas'][number]): {
    feitos: number;
    total: number;
    pct: number;
  } {
    const fases = this.gradePassos();
    const feitos = fases.filter(
      (f) => linha.status[f.numero] === 'realizado',
    ).length;
    const total = fases.length;
    return { feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0 };
  }

  /** Colunas do quadro: uma por PASSO do processo, na ordem, e SÓ as que têm projeto.
   *
   * Coluna vazia some de propósito — com 18 fases, mostrar todas deixaria o quadro largo e
   * quase todo em branco. O quadro cresce conforme o trabalho anda. */
  readonly colunas = computed(() => {
    const porPasso = new Map<number, Projeto[]>();
    const concluidos: Projeto[] = [];
    const semInformacao: Projeto[] = [];
    const mapa = this.passoPorProjeto();

    for (const p of this.filtrados()) {
      const atual = mapa.get(p.id);
      // Duas ausências DIFERENTES, que não podem cair no mesmo balde: `passo: null` é
      // processo terminado; sem entrada no mapa é falta de informação (por exemplo, a
      // chamada dos passos falhou). Tratar o segundo como "concluído" mentiria na tela.
      if (!atual) {
        semInformacao.push(p);
        continue;
      }
      if (atual.passo === null) {
        concluidos.push(p);
        continue;
      }
      const lista = porPasso.get(atual.passo) ?? [];
      lista.push(p);
      porPasso.set(atual.passo, lista);
    }

    const colunas = [...porPasso.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([numero, projetos]) => {
        const ref = mapa.get(projetos[0].id);
        return {
          numero,
          titulo: ref?.titulo ?? '',
          etapa: ref?.etapa ?? '',
          responsavel: ref?.responsavel ?? null,
          projetos,
        };
      });

    if (concluidos.length > 0) {
      colunas.push({
        numero: 0,
        titulo: 'Processo concluído',
        etapa: 'Encerramento',
        responsavel: null,
        projetos: concluidos,
      });
    }
    if (semInformacao.length > 0) {
      colunas.push({
        numero: -1,
        titulo: 'Fase não identificada',
        etapa: '',
        responsavel: null,
        projetos: semInformacao,
      });
    }
    return colunas;
  });

  /** Progresso do projeto no processo, para a barra do card. */
  progresso(projetoId: number): number {
    const a = this.passoPorProjeto().get(projetoId);
    if (!a || a.total === 0) return 0;
    return Math.round((a.concluidos / a.total) * 100);
  }

  atual(projetoId: number): PassoAtualDoProjeto | undefined {
    return this.passoPorProjeto().get(projetoId);
  }

  readonly perfilNomeConsultor = computed(() => {
    const u = this.auth.usuario();
    return temPapel(u, 'Consultor') ? (u?.nome ?? null) : null;
  });

  constructor() {
    const v = (localStorage.getItem('vista_carteira') as Vista | null) ?? 'kanban';
    this.vista.set(v);
    this.busca.set(this.route.snapshot.queryParamMap.get('q') ?? '');
    void this.carregar();
    if (v === 'grade') void this.carregarGrade();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [res, atuais] = await Promise.all([
        this.service.listar({ page: 1, limit: 1000 }),
        this.passosService.atuais(),
      ]);
      this.todos.set(res.data);
      this.passoPorProjeto.set(new Map(atuais.map((a) => [a.projetoId, a])));
      // A grade é derivada dos mesmos dados; invalida para recarregar se estiver aberta.
      this.grade.set(null);
      if (this.vista() === 'grade') void this.carregarGrade();
    } catch {
      this.erro.set('Não foi possível carregar os projetos.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Carrega a grade sob demanda (uma vez; reidrata após `carregar()` a invalidar). */
  async carregarGrade(): Promise<void> {
    if (this.grade() || this.carregandoGrade()) return;
    this.carregandoGrade.set(true);
    try {
      this.grade.set(await this.passosService.grade());
    } catch {
      /* mantém null — a grade mostra o aviso de vazio. */
    } finally {
      this.carregandoGrade.set(false);
    }
  }

  setVista(v: Vista): void {
    this.vista.set(v);
    localStorage.setItem('vista_carteira', v);
    if (v === 'grade') void this.carregarGrade();
  }

  async excluir(projeto: Projeto): Promise<void> {
    if (!confirm(`Excluir o projeto "${projeto.cliente}"?`)) return;
    await this.service.excluir(projeto.id);
    await this.carregar();
  }
}
