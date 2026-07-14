import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CronogramaService } from '../../core/services/cronograma.service';
import {
  AtividadeCronograma,
  CRONO_STATUS_AGENDA,
  Designacao,
  NOMES_DIA_SEMANA,
  PeriodoBloqueado,
  Prontidao,
  VisitaAgrupada,
} from '../../core/models/cronograma.model';

interface DiaSemana {
  iso: string;
  label: string;
}

interface MovimentoVisita {
  data: string;
  turno: string;
}

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.css',
})
export class AgendaComponent {
  private readonly service = inject(CronogramaService);
  private readonly route = inject(ActivatedRoute);

  readonly statusOpcoes = CRONO_STATUS_AGENDA;
  readonly nomesDiaSemana = NOMES_DIA_SEMANA;
  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly processando = signal<string | null>(null);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly visitas = signal<VisitaAgrupada[]>([]);
  readonly designacoes = signal<Designacao[]>([]);
  readonly periodos = signal<PeriodoBloqueado[]>([]);
  readonly prontidao = signal<Prontidao>({ faltantes: [], jaOcorreu: false });
  readonly referencia = signal(this.segundaFeiraDe(new Date()));

  // Estado local dos formulários "mover/alocar visita" e "novo período", chaveados por modulo|seq.
  readonly movimentos = new Map<string, MovimentoVisita>();
  novoPeriodo = { dataIni: '', dataFim: '', motivo: '', tecnicos: [] as string[] };

  readonly tecnicosEnvolvidos = computed(() => {
    const nomes = new Set<string>();
    for (const d of this.designacoes()) if (d.consultor) nomes.add(d.consultor);
    return [...nomes].sort();
  });

  readonly semana = computed<DiaSemana[]>(() => {
    const seg = this.referencia();
    const nomes = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(seg.getTime() + i * 86_400_000);
      return { iso: this.paraIso(d), label: `${nomes[i]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}` };
    });
  });

  readonly modulosVisitas = computed(() => {
    const mapa = new Map<string, VisitaAgrupada[]>();
    for (const v of this.visitas()) {
      if (!mapa.has(v.modulo)) mapa.set(v.modulo, []);
      mapa.get(v.modulo)!.push(v);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  readonly pendentes = computed(() =>
    this.visitas().filter((v) => v.atividades.every((a) => !(a.data && a.turno) && this.emAberto(a))),
  );

  constructor() {
    void this.carregar();
  }

  private emAberto(a: AtividadeCronograma): boolean {
    return ['', 'Solicitada', 'Agendada'].includes(a.status || '');
  }

  private segundaFeiraDe(d: Date): Date {
    const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const diaSemana = (utc.getUTCDay() + 6) % 7; // 0=segunda
    return new Date(utc.getTime() - diaSemana * 86_400_000);
  }

  private paraIso(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [visitas, designacoes, periodos, prontidao] = await Promise.all([
        this.service.visitas(this.projetoId),
        this.service.designacoes(this.projetoId),
        this.service.periodos(this.projetoId),
        this.service.prontidao(this.projetoId),
      ]);
      this.visitas.set(visitas);
      this.designacoes.set(designacoes);
      this.periodos.set(periodos);
      this.prontidao.set(prontidao);
    } catch {
      this.erro.set('Não foi possível carregar o agendador de visitas.');
    } finally {
      this.carregando.set(false);
    }
  }

  celula(iso: string, turno: string): VisitaAgrupada[] {
    const grupos = new Map<string, VisitaAgrupada>();
    for (const v of this.visitas()) {
      for (const a of v.atividades) {
        if (a.data !== iso || a.turno !== turno || !this.emAberto(a)) continue;
        const chave = `${v.modulo}|${v.seq}`;
        if (!grupos.has(chave)) grupos.set(chave, { modulo: v.modulo, seq: v.seq, atividades: [] });
        grupos.get(chave)!.atividades.push(a);
      }
    }
    return [...grupos.values()];
  }

  designacaoDe(modulo: string): Designacao {
    return this.designacoes().find((d) => d.modulo === modulo) ?? { modulo, consultor: '', ordem: 0, naoDistribuir: false, analista: '' };
  }

  chave(v: { modulo: string; seq: number }): string {
    return `${v.modulo}|${v.seq}`;
  }

  movimento(v: { modulo: string; seq: number }): MovimentoVisita {
    const k = this.chave(v);
    if (!this.movimentos.has(k)) this.movimentos.set(k, { data: '', turno: 'manha' });
    return this.movimentos.get(k)!;
  }

  semanaAnterior(): void {
    this.referencia.set(new Date(this.referencia().getTime() - 7 * 86_400_000));
  }

  semanaSeguinte(): void {
    this.referencia.set(new Date(this.referencia().getTime() + 7 * 86_400_000));
  }

  irParaHoje(): void {
    this.referencia.set(this.segundaFeiraDe(new Date()));
  }

  private async comFeedback(rotina: () => Promise<void>): Promise<void> {
    this.erro.set(null);
    this.aviso.set(null);
    try {
      await rotina();
    } catch (e) {
      const msg = e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : 'Falha na operação.';
      this.erro.set(msg);
    }
  }

  async salvarDesignacao(
    modulo: string,
    campo: { tecnico?: string; ordem?: number; naoDistribuir?: boolean; analista?: string },
  ): Promise<void> {
    await this.comFeedback(async () => {
      await this.service.salvarDesignacao(this.projetoId, { modulo, ...campo });
      await this.carregar();
    });
  }

  async aplicarMovimento(v: VisitaAgrupada): Promise<void> {
    const mov = this.movimento(v);
    await this.comFeedback(async () => {
      await this.service.alocarVisita(this.projetoId, v.modulo, v.seq, mov.data || undefined, mov.turno || undefined);
      await this.carregar();
    });
  }

  async desalocar(v: VisitaAgrupada): Promise<void> {
    await this.comFeedback(async () => {
      await this.service.alocarVisita(this.projetoId, v.modulo, v.seq, undefined, undefined);
      await this.carregar();
    });
  }

  async mudarStatus(atividadeId: number, status: string): Promise<void> {
    await this.comFeedback(async () => {
      await this.service.status(this.projetoId, atividadeId, status);
      await this.carregar();
    });
  }

  private async rotina(texto: string, acao: () => Promise<{ ok: boolean; erro?: string; aviso?: string }>): Promise<void> {
    this.processando.set(texto);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const r = await acao();
      if (!r.ok) this.erro.set(r.erro || 'Não foi possível concluir.');
      else this.aviso.set(r.aviso || 'Concluído.');
      await this.carregar();
    } catch {
      this.erro.set('Erro de rede ao processar a rotina.');
    } finally {
      this.processando.set(null);
    }
  }

  distribuir(): Promise<void> {
    return this.rotina('Distribuindo agendas…', () => this.service.distribuir(this.projetoId));
  }

  redistribuir(): Promise<void> {
    if (!confirm('Refazer a distribuição automática? Isso desfaz só o que a própria distribuição alocou.')) {
      return Promise.resolve();
    }
    return this.rotina('Refazendo distribuição…', () => this.service.redistribuir(this.projetoId));
  }

  desfazerTudo(): Promise<void> {
    if (!confirm('Desfazer TODAS as agendas (automáticas e manuais) deste cronograma?')) return Promise.resolve();
    return this.rotina('Desfazendo todas as agendas…', () => this.service.desfazerTudo(this.projetoId));
  }

  async criarPeriodo(): Promise<void> {
    await this.comFeedback(async () => {
      await this.service.criarPeriodo(this.projetoId, this.novoPeriodo);
      this.novoPeriodo = { dataIni: '', dataFim: '', motivo: '', tecnicos: [] };
      await this.carregar();
    });
  }

  async excluirPeriodo(id: number): Promise<void> {
    if (!confirm('Excluir este período sem agenda?')) return;
    await this.comFeedback(async () => {
      await this.service.excluirPeriodo(this.projetoId, id);
      await this.carregar();
    });
  }

  alternarTecnicoNoPeriodo(nome: string, marcado: boolean): void {
    const set = new Set(this.novoPeriodo.tecnicos);
    if (marcado) set.add(nome);
    else set.delete(nome);
    this.novoPeriodo.tecnicos = [...set];
  }
}
