import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CronogramaService } from '../../core/services/cronograma.service';
import { AuthService } from '../../core/services/auth.service';
import {
  AtividadeCronograma,
  CronogramaConfigDto,
  CRONO_STATUS_AGENDA,
  Designacao,
  HorariosPorTurno,
  NOMES_DIA_SEMANA,
  PeriodoBloqueado,
  Prontidao,
  VisitaAgrupada,
} from '../../core/models/cronograma.model';

interface DiaSemana {
  iso: string;
  label: string;
}

interface VisitaComPendentes extends VisitaAgrupada {
  pendentes: AtividadeCronograma[];
}

interface ModuloAgrupado {
  modulo: string;
  visitas: VisitaComPendentes[];
  pend: number;
  n: number;
}

type ModoPostergar = 'card' | 'slot' | 'bloco';

interface EstadoModalPostergar {
  modo: ModoPostergar;
  atividadeId?: number;
  data?: string;
  turno?: string;
  modulo?: string;
  seq?: number;
}

function parseDiasExcluidos(s: string): { diaSemana: number; turno: string }[] {
  const out: { diaSemana: number; turno: string }[] = [];
  for (const tok of (s || '').split(',')) {
    const t = tok.trim();
    if (!t || !t.includes('-')) continue;
    const [wdStr, turno] = t.split('-', 2);
    const wd = Number(wdStr);
    if (Number.isFinite(wd) && wd >= 0 && wd <= 4 && (turno === 'manha' || turno === 'tarde')) {
      out.push({ diaSemana: wd, turno });
    }
  }
  return out;
}

function baixarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly statusOpcoes = CRONO_STATUS_AGENDA;
  readonly nomesDiaSemana = NOMES_DIA_SEMANA;
  readonly diasSemanaIdx = [0, 1, 2, 3, 4];
  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly processando = signal<string | null>(null);
  readonly gerandoXlsx = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly visitas = signal<VisitaAgrupada[]>([]);
  readonly designacoes = signal<Designacao[]>([]);
  readonly periodos = signal<PeriodoBloqueado[]>([]);
  readonly bloqueios = signal<Record<string, string>>({});
  readonly prontidao = signal<Prontidao>({ faltantes: [], jaOcorreu: false });
  readonly horarios = signal<HorariosPorTurno>({ manha: { inicio: '08:00', fim: '12:00' }, tarde: { inicio: '13:00', fim: '17:00' } });
  readonly config = signal<CronogramaConfigDto>({
    modoDisponibilidade: 'conjunta',
    dataInicio: '',
    diasTurnosExcluidos: '',
    analistaPadrao: '',
  });
  readonly referencia = signal(this.segundaFeiraDe(new Date()));

  novoPeriodo = { dataIni: '', dataFim: '', motivo: '', tecnicos: [] as string[] };

  readonly dragCard = signal<AtividadeCronograma | null>(null);
  readonly dragGrupo = signal<{ modulo: string; seq: number } | null>(null);
  readonly zonaSobreArraste = signal<string | null>(null);

  readonly modalPostergar = signal<EstadoModalPostergar | null>(null);
  novaDataPostergar = '';
  novoTurnoPostergar = 'manha';

  readonly ehAdm = computed(() => this.auth.usuario()?.perfil === 'ADM');

  readonly hojeIso = new Date().toISOString().slice(0, 10);

  readonly tecnicosEnvolvidos = computed(() => {
    const nomes = new Set<string>();
    for (const d of this.designacoes()) if (d.consultor) nomes.add(d.consultor);
    return [...nomes].sort();
  });

  readonly semana = computed<DiaSemana[]>(() => {
    const seg = this.referencia();
    const nomes = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(seg.getTime() + i * 86_400_000);
      return { iso: this.paraIso(d), label: `${nomes[i]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}` };
    });
  });

  readonly modulosAgrupados = computed<ModuloAgrupado[]>(() => {
    const porModulo = new Map<string, VisitaAgrupada[]>();
    for (const v of this.visitas()) {
      if (!porModulo.has(v.modulo)) porModulo.set(v.modulo, []);
      porModulo.get(v.modulo)!.push(v);
    }
    return [...porModulo.entries()]
      .map(([modulo, visitas]) => {
        const comPendentes = visitas
          .slice()
          .sort((a, b) => a.seq - b.seq)
          .map((v) => ({ ...v, pendentes: v.atividades.filter((a) => !(a.data && a.turno) && this.emAberto(a)) }));
        const n = comPendentes.reduce((acc, v) => acc + v.atividades.filter((a) => this.emAberto(a)).length, 0);
        const pend = comPendentes.reduce((acc, v) => acc + v.pendentes.length, 0);
        return { modulo, visitas: comPendentes, pend, n };
      })
      .sort((a, b) => a.modulo.localeCompare(b.modulo));
  });

  readonly totalPendentes = computed(() => this.modulosAgrupados().reduce((acc, m) => acc + m.pend, 0));

  readonly diasExcluidos = computed(() => parseDiasExcluidos(this.config().diasTurnosExcluidos));

  constructor() {
    void this.carregar();
  }

  private emAberto(a: AtividadeCronograma): boolean {
    return ['', 'Solicitada', 'Agendada'].includes(a.status || '');
  }

  private segundaFeiraDe(d: Date): Date {
    const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const diaSemana = (utc.getUTCDay() + 6) % 7;
    return new Date(utc.getTime() - diaSemana * 86_400_000);
  }

  private paraIso(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [visitas, designacoes, periodos, prontidao, horarios, config] = await Promise.all([
        this.service.visitas(this.projetoId),
        this.service.designacoes(this.projetoId),
        this.service.periodos(this.projetoId),
        this.service.prontidao(this.projetoId),
        this.service.horarios(this.projetoId),
        this.service.config(this.projetoId),
      ]);
      this.visitas.set(visitas);
      this.designacoes.set(designacoes);
      this.periodos.set(periodos);
      this.prontidao.set(prontidao);
      this.horarios.set(horarios);
      this.config.set(config);
      await this.carregarBloqueios();
    } catch {
      this.erro.set('Não foi possível carregar o agendador de visitas.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Indicador visual (cosmético) de conflito SICLA/período sem agenda na semana exibida —
   * quem bloqueia de verdade a escrita é o backend, em `alocar`/`alocarVisita`. */
  private async carregarBloqueios(): Promise<void> {
    const dias = this.semana();
    if (dias.length === 0) return;
    try {
      this.bloqueios.set(await this.service.bloqueios(this.projetoId, dias[0].iso, dias[dias.length - 1].iso));
    } catch {
      this.bloqueios.set({});
    }
  }

  motivoBloqueio(iso: string, turno: string): string | null {
    return this.bloqueios()[`${iso}|${turno}`] ?? null;
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

  horarioDe(turno: string): { inicio: string; fim: string } {
    return turno === 'tarde' ? this.horarios().tarde : this.horarios().manha;
  }

  classeStatus(status: string): string {
    const mapa: Record<string, string> = {
      Postergada: 'ag-st-post',
      Cancelada: 'ag-st-canc',
      Realizada: 'ag-st-real',
      'Não Realizada': 'ag-st-nrea',
    };
    return mapa[status] ?? '';
  }

  semanaAnterior(): void {
    this.referencia.set(new Date(this.referencia().getTime() - 7 * 86_400_000));
    void this.carregarBloqueios();
  }

  semanaSeguinte(): void {
    this.referencia.set(new Date(this.referencia().getTime() + 7 * 86_400_000));
    void this.carregarBloqueios();
  }

  irParaHoje(): void {
    this.referencia.set(this.segundaFeiraDe(new Date()));
    void this.carregarBloqueios();
  }

  private async comFeedback(rotina: () => Promise<void>): Promise<void> {
    this.erro.set(null);
    this.aviso.set(null);
    try {
      await rotina();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Falha na operação.'));
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

  async salvarTecnicoCard(atividadeId: number, tecnico: string): Promise<void> {
    await this.comFeedback(async () => {
      await this.service.alocar(this.projetoId, atividadeId, { tecnico });
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
    if (!confirm('Refazer a distribuição automática? Isso desfaz só o que a própria distribuição alocou (nenhuma alocação manual é tocada) e distribui de novo.')) {
      return Promise.resolve();
    }
    return this.rotina('Refazendo distribuição…', () => this.service.redistribuir(this.projetoId));
  }

  desfazerTudo(): Promise<void> {
    if (!confirm('Desfazer TODAS as agendas deste cronograma (automáticas e manuais)? Todos os assuntos ainda abertos voltam para a lista de pendentes.')) {
      return Promise.resolve();
    }
    return this.rotina('Desfazendo todas as agendas…', () => this.service.desfazerTudo(this.projetoId));
  }

  async gerarXlsx(): Promise<void> {
    if (this.gerandoXlsx()) return;
    this.gerandoXlsx.set(true);
    this.erro.set(null);
    try {
      const arquivo = await this.service.gerarXlsx(this.projetoId);
      baixarBlob(arquivo.blob, arquivo.filename);
      this.aviso.set(`${arquivo.filename} gerado e anexado à ficha.`);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Aloque ao menos uma atividade no calendário antes de gerar o cronograma.'));
    } finally {
      this.gerandoXlsx.set(false);
    }
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

  async salvarHorarioCampo(turno: 'manha' | 'tarde', campo: 'inicio' | 'fim', valor: string): Promise<void> {
    const atual = this.horarios();
    const novo = { ...atual, [turno]: { ...atual[turno], [campo]: valor } };
    this.horarios.set(novo);
    await this.comFeedback(() => this.service.salvarHorario(this.projetoId, turno, novo[turno].inicio, novo[turno].fim));
  }

  diaTurnoIncluido(wd: number, turno: string): boolean {
    return !this.diasExcluidos().some((d) => d.diaSemana === wd && d.turno === turno);
  }

  async alternarDiaTurno(wd: number, turno: 'manha' | 'tarde', incluir: boolean): Promise<void> {
    const atuais = this.diasExcluidos();
    const proximos = incluir
      ? atuais.filter((d) => !(d.diaSemana === wd && d.turno === turno))
      : [...atuais, { diaSemana: wd, turno }];
    await this.comFeedback(async () => {
      const cfg = await this.service.salvarConfig(this.projetoId, { diasExcluidos: proximos });
      this.config.set(cfg);
    });
  }

  async salvarModoDistribuicao(modo: string): Promise<void> {
    await this.comFeedback(async () => {
      const cfg = await this.service.salvarConfig(this.projetoId, { modo });
      this.config.set(cfg);
    });
  }

  async salvarDataInicioDistribuicao(dataInicio: string): Promise<void> {
    await this.comFeedback(async () => {
      const cfg = await this.service.salvarConfig(this.projetoId, { dataInicio });
      this.config.set(cfg);
    });
  }

  async salvarAnalistaPadrao(analistaPadrao: string): Promise<void> {
    await this.comFeedback(async () => {
      const cfg = await this.service.salvarConfig(this.projetoId, { analistaPadrao });
      this.config.set(cfg);
    });
  }

  // ---- Arrastar e soltar ----

  iniciarArrasteCard(ev: DragEvent, a: AtividadeCronograma): void {
    this.dragGrupo.set(null);
    this.dragCard.set(a);
    ev.dataTransfer?.setData('text/plain', String(a.id));
  }

  iniciarArrasteGrupo(ev: DragEvent, modulo: string, seq: number): void {
    ev.stopPropagation();
    this.dragCard.set(null);
    this.dragGrupo.set({ modulo, seq });
    ev.dataTransfer?.setData('text/plain', 'grupo');
  }

  aoTerminarArraste(): void {
    this.dragCard.set(null);
    this.dragGrupo.set(null);
    this.zonaSobreArraste.set(null);
  }

  permitirSolta(ev: DragEvent, zonaChave: string): void {
    ev.preventDefault();
    this.zonaSobreArraste.set(zonaChave);
  }

  saiuDaZona(): void {
    this.zonaSobreArraste.set(null);
  }

  async soltarEm(ev: DragEvent, iso: string, turno: string): Promise<void> {
    ev.preventDefault();
    this.zonaSobreArraste.set(null);
    const grupo = this.dragGrupo();
    const card = this.dragCard();
    this.dragGrupo.set(null);
    this.dragCard.set(null);
    if (grupo) {
      await this.comFeedback(async () => {
        const n = await this.service.alocarVisita(this.projetoId, grupo.modulo, grupo.seq, iso || undefined, turno || undefined);
        if (!n) {
          this.erro.set('Nada para mover: os assuntos desse bloco já foram concluídos, cancelados ou postergados.');
          return;
        }
        await this.carregar();
      });
      return;
    }
    if (card) {
      await this.comFeedback(async () => {
        await this.service.alocar(this.projetoId, card.id, { data: iso || undefined, turno: turno || undefined });
        await this.carregar();
      });
    }
  }

  // ---- Postergar ----

  abrirPostergarCard(a: AtividadeCronograma): void {
    this.modalPostergar.set({ modo: 'card', atividadeId: a.id });
    this.novaDataPostergar = '';
    this.novoTurnoPostergar = 'manha';
  }

  abrirPostergarSlot(iso: string, turno: string): void {
    this.modalPostergar.set({ modo: 'slot', data: iso, turno });
    this.novaDataPostergar = '';
    this.novoTurnoPostergar = 'manha';
  }

  abrirPostergarBloco(modulo: string, seq: number): void {
    this.modalPostergar.set({ modo: 'bloco', modulo, seq });
    this.novaDataPostergar = '';
    this.novoTurnoPostergar = 'manha';
  }

  fecharModalPostergar(): void {
    this.modalPostergar.set(null);
  }

  async confirmarPostergar(): Promise<void> {
    const est = this.modalPostergar();
    if (!est || !this.novaDataPostergar) return;
    if (est.modo === 'bloco') {
      await this.comFeedback(async () => {
        const n = await this.service.postergarVisita(this.projetoId, {
          modulo: est.modulo!,
          seq: est.seq!,
          novaData: this.novaDataPostergar,
          novoTurno: this.novoTurnoPostergar,
        });
        this.modalPostergar.set(null);
        if (confirm(`Visita postergada (${n} assunto(s)). Deseja reorganizar (realocar) as demais visitas deste módulo, respeitando a nova ordem?`)) {
          await this.rotina('Reorganizando módulo…', () => this.service.reorganizarModulo(this.projetoId, est.modulo!));
        } else {
          await this.carregar();
        }
      });
      return;
    }
    await this.comFeedback(async () => {
      await this.service.postergar(this.projetoId, {
        atividadeId: est.atividadeId,
        data: est.data,
        turno: est.turno,
        novaData: this.novaDataPostergar,
        novoTurno: this.novoTurnoPostergar,
      });
      this.modalPostergar.set(null);
      await this.carregar();
    });
  }

  async excluirAtividade(a: AtividadeCronograma): Promise<void> {
    if (!confirm('Excluir esta visita postergada em definitivo? Isso não pode ser desfeito.')) return;
    await this.comFeedback(async () => {
      await this.service.atividadeExcluir(this.projetoId, a.id);
      await this.carregar();
    });
  }
}
