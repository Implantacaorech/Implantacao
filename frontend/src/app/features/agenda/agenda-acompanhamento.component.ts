import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CronogramaService } from '../../core/services/cronograma.service';
import {
  AtividadeCronograma,
  CRONO_STATUS_AGENDA,
  HorariosPorTurno,
  StatusAgenda,
} from '../../core/models/cronograma.model';
import { deCamposDe, filtrosSalvos } from '../../core/utils/filtros-salvos';

function paraIsoData(v: string): string {
  return v.slice(0, 10);
}

@Component({
  selector: 'app-agenda-acompanhamento',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './agenda-acompanhamento.component.html',
  styleUrl: './agenda-acompanhamento.component.css',
})
export class AgendaAcompanhamentoComponent {
  private readonly service = inject(CronogramaService);
  private readonly route = inject(ActivatedRoute);

  readonly statusOpcoes = CRONO_STATUS_AGENDA;
  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly todasAtividades = signal<AtividadeCronograma[]>([]);
  readonly horarios = signal<HorariosPorTurno>({ manha: { inicio: '', fim: '' }, tarde: { inicio: '', fim: '' } });

  fStatus = '';
  fData = '';
  fTecnico = '';

  readonly alocadas = computed(() => this.todasAtividades().filter((a) => a.data && a.turno));

  readonly datas = computed(() => [...new Set(this.alocadas().map((a) => paraIsoData(a.data)))].sort());
  readonly tecnicos = computed(() => [...new Set(this.alocadas().map((a) => a.tecnico).filter(Boolean))].sort());

  readonly contagem = computed(() => {
    const mapa = new Map<string, number>();
    for (const s of this.statusOpcoes) mapa.set(s, 0);
    for (const a of this.alocadas()) mapa.set(a.status, (mapa.get(a.status) ?? 0) + 1);
    return mapa;
  });

  readonly totalTodas = computed(() => this.alocadas().length);

  readonly atividadesFiltradas = computed(() => {
    return this.alocadas()
      .filter((a) => !this.fStatus || a.status === this.fStatus)
      .filter((a) => !this.fData || paraIsoData(a.data) === this.fData)
      .filter((a) => !this.fTecnico || a.tecnico === this.fTecnico)
      .sort((a, b) => (a.data + a.turno).localeCompare(b.data + b.turno));
  });

  /** Filtros salvos por usuário logado. Propriedades comuns: a gravação é explícita, feita
   * nos pontos em que o filtro muda (`filtrarPorStatus` e o `ngModelChange` dos selects). */
  private readonly salvos = filtrosSalvos(
    'agenda-acompanhamento',
    deCamposDe(this, 'fStatus', 'fData', 'fTecnico'),
  );

  constructor() {
    void this.carregar();
  }

  /** Chamado pelos selects: guarda o recorte escolhido. */
  aplicarFiltros(): void {
    this.salvos.salvar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [atividades, horarios] = await Promise.all([
        this.service.atividades(this.projetoId),
        this.service.horarios(this.projetoId),
      ]);
      this.todasAtividades.set(atividades);
      this.horarios.set(horarios);
      this.descartarFiltrosForaDesteProjeto();
    } catch {
      this.erro.set('Não foi possível carregar o acompanhamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Esta tela é POR PROJETO, mas a preferência é do usuário: a data e o técnico salvos podem
   * ser de outro projeto e não existir na agenda deste. Mantê-los deixaria a tabela vazia sem
   * explicação — então o que não existe aqui é descartado (o status, que é lista fixa, fica). */
  private descartarFiltrosForaDesteProjeto(): void {
    if (this.fData && !this.datas().includes(this.fData)) this.fData = '';
    if (this.fTecnico && !this.tecnicos().includes(this.fTecnico)) this.fTecnico = '';
  }

  horarioDe(turno: string): string {
    const h = turno === 'tarde' ? this.horarios().tarde : this.horarios().manha;
    return h.inicio || h.fim ? `${h.inicio}–${h.fim}` : '';
  }

  filtrarPorStatus(status: string): void {
    this.fStatus = status;
    this.salvos.salvar();
  }

  limparFiltros(): void {
    this.fStatus = '';
    this.fData = '';
    this.fTecnico = '';
    // "Limpar" é voltar ao padrão da tela, não fixar o vazio como escolha do usuário.
    void this.salvos.descartar();
  }

  classeChip(status: string): string {
    return status
      .replaceAll(' ', '')
      .replaceAll('ã', 'a')
      .replaceAll('ç', 'c')
      .toLowerCase();
  }

  formatarData(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
  }

  async mudarStatus(a: AtividadeCronograma, novoStatus: string, select: HTMLSelectElement): Promise<void> {
    try {
      await this.service.status(this.projetoId, a.id, novoStatus);
      this.todasAtividades.set(
        this.todasAtividades().map((x) => (x.id === a.id ? { ...x, status: novoStatus as StatusAgenda } : x)),
      );
    } catch {
      select.value = a.status;
      alert('Não foi possível atualizar o status.');
    }
  }
}
