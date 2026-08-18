import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgendaCalendarioService } from '../../core/services/agenda-calendario.service';
import { AuthService } from '../../core/services/auth.service';
import { RnsService } from '../../core/services/rns.service';
import {
  CompromissoAgenda,
  DiaAgenda,
  ResultadoAgendaCalendario,
  UsuarioAgenda,
} from '../../core/models/agenda-calendario.model';
import { ResultadoDetalheRns } from '../../core/models/rns.model';
import { RnsDetalheComponent } from '../rns/rns-detalhe.component';

export type VisaoAgenda = 'dia' | 'semana' | 'mes';

const NOMES_MES = [
  '', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const NOMES_DIA = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
];

const ROTULO_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Cor da borda por status — mesmo vocabulário/cores dos calendários de BI que leem esta
 * origem (`bi-alocacao-calendario`); a view nunca guarda 8-Postergada/9-Cancelada. */
const COR_BORDA: Record<string, string> = {
  '1-Solicitada': '#e6c200',
  '3-Agendada': '#00b300',
  '6-Realizada': '#ffaa00',
  '7-Não realizada': '#b8860b',
};

/** Faixas de criticidade pela DURAÇÃO do compromisso (minutos) — mesmas faixas/cores do
 * cartão "Agendas do Técnico" do BI Alocação (`bi-alocacao-calendario`), de propósito:
 * o modal desta tela mostra a agenda no MESMO desenho daquele cartão. */
const CRITICIDADE: { ate: number; rotulo: string; cor: string }[] = [
  { ate: 60, rotulo: 'NORMAL', cor: '#22c55e' },
  { ate: 120, rotulo: 'MÉDIO', cor: '#f0b429' },
  { ate: 240, rotulo: 'ALTO', cor: '#f97316' },
  { ate: Infinity, rotulo: 'CRÍTICO', cor: '#e11d48' },
];

/** Sem acento, caixa nem espaço duplicado — é assim que o nome do usuário do Painel é
 * comparado com o `TECNICO` do SICLA (os dois nascem de `LISTA_TECNICOS.NOME`, mas um
 * cadastro pode divergir em caixa/acento). */
function normalizarNome(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Os dois textos nomeiam a mesma pessoa? Igualdade normalizada, com tolerância de
 * abreviação (um contém o outro) — o SICLA às vezes grava só o primeiro nome. */
function mesmoNome(a: string, b: string): boolean {
  const na = normalizarNome(a);
  const nb = normalizarNome(b);
  return !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
}

function parseIso(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDias(iso: string, n: number): string {
  return toIso(new Date(parseIso(iso).getTime() + n * 86_400_000));
}

/** Hoje no fuso de quem usa (getters LOCAIS de propósito — `toISOString()` é UTC e, à
 * noite, já seria "amanhã"; mesma decisão do `hojeIso()` do backend). */
function hojeIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Tela **Execução → Agenda** — calendário de compromissos dos técnicos (origem SICLA),
 * aberto em **visão semanal** e **filtrado no usuário logado** por padrão (decisão do
 * usuário, 2026-08-14), com visões mensal e diária e a opção de ver a equipe inteira.
 * O backend entrega a janela inteira; todos os filtros desta tela são em memória. */
@Component({
  selector: 'app-agenda-calendario',
  standalone: true,
  imports: [FormsModule, RnsDetalheComponent],
  templateUrl: './agenda-calendario.component.html',
  styleUrl: './agenda-calendario.component.css',
})
export class AgendaCalendarioComponent {
  private readonly service = inject(AgendaCalendarioService);
  private readonly auth = inject(AuthService);
  private readonly rnsService = inject(RnsService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoAgendaCalendario | null>(null);

  /** Semanal é o PADRÃO da tela (decisão do usuário, 2026-08-14). */
  readonly visao = signal<VisaoAgenda>('semana');
  /** Dia-âncora do período visível: a semana/mês/dia mostrados são os que o contêm. */
  readonly referencia = signal<string>(hojeIsoLocal());

  /** Usuários do Painel (tabela `usuarios`, importada de SICLA.LISTA_TECNICOS) — é DELA
   * que nasce o filtro de técnicos, não só de quem tem compromisso no período. */
  readonly usuarios = signal<UsuarioAgenda[]>([]);
  /** NOMES selecionados no filtro de técnicos. Vazio = todas as agendas. A carga inicial
   * seleciona o usuário logado, resolvido na tabela de usuários (verMinhas). */
  readonly responsaveisSel = signal<string[]>([]);
  readonly buscaTecnico = signal('');
  readonly statusSel = signal<string[]>([]);
  /** Códigos de espécie selecionados (como texto — é o valor do checkbox). */
  readonly especiesSel = signal<string[]>([]);
  readonly busca = signal('');
  readonly filtrosAbertos = signal(false);

  // ── Detalhe do compromisso (modal aberto pelo clique) ──────────────────────────────

  /** Compromisso clicado — abre o modal com os dados da agenda (horário, duração,
   * espécie, status, observação); null = fechado. */
  readonly compromissoAberto = signal<CompromissoAgenda | null>(null);
  readonly rnsCarregando = signal(false);
  readonly rnsErro = signal<string | null>(null);
  readonly rnsDetalhe = signal<ResultadoDetalheRns | null>(null);

  constructor() {
    // Carga inicial JÁ filtrada no usuário logado — primeiro com o nome do login; quando a
    // tabela de usuários chega, verMinhas troca pela grafia da tabela (a que bate com o
    // TECNICO do SICLA), desde que o filtro ainda esteja em "minhas agendas".
    const meu = this.auth.usuario()?.nome ?? '';
    if (meu) this.responsaveisSel.set([meu]);
    void this.carregar();
    void this.carregarUsuarios();
  }

  private async carregarUsuarios(): Promise<void> {
    try {
      this.usuarios.set(await this.service.usuarios());
    } catch {
      this.usuarios.set([]); // sem a tabela, o filtro segue com o nome do login
    }
    if (this.minhasAgendas()) this.verMinhas();
  }

  /** Janela [ini, fim] da visão sobre o dia-âncora. Semana = domingo→sábado, o mesmo
   * desenho da grade mensal (e o default do backend). */
  intervalo(): { ini: string; fim: string } {
    const ref = this.referencia();
    const v = this.visao();
    if (v === 'dia') return { ini: ref, fim: ref };
    if (v === 'semana') {
      const ini = addDias(ref, -parseIso(ref).getUTCDay());
      return { ini, fim: addDias(ini, 6) };
    }
    const [ano, mes] = ref.split('-').map(Number);
    return {
      ini: `${ref.slice(0, 7)}-01`,
      fim: toIso(new Date(Date.UTC(ano, mes, 0))),
    };
  }

  async carregar(): Promise<void> {
    const { ini, fim } = this.intervalo();
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.calendario(ini, fim);
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
    } catch {
      this.erro.set(
        'Não foi possível carregar a Agenda. Verifique a conexão e tente de novo.',
      );
    } finally {
      this.carregando.set(false);
    }
  }

  // ── Filtros (todos em memória — o backend já entregou a janela inteira) ────────────

  /** O filtro está exatamente em "minhas agendas"? (um só selecionado, e é o usuário.) */
  readonly minhasAgendas = computed(() => {
    const sel = this.responsaveisSel();
    return sel.length === 1 && mesmoNome(sel[0], this.auth.usuario()?.nome ?? '');
  });

  private passa(c: CompromissoAgenda): boolean {
    const sel = this.responsaveisSel();
    if (sel.length > 0 && !sel.some((n) => mesmoNome(n, c.tecnico))) {
      return false;
    }
    const st = this.statusSel();
    if (st.length > 0 && !st.includes(c.status)) return false;
    const esp = this.especiesSel();
    if (esp.length > 0 && !esp.includes(String(c.especie))) return false;
    const q = this.busca().trim().toLowerCase();
    if (!q) return true;
    return (
      c.fantasia.toLowerCase().includes(q) ||
      c.assunto.toLowerCase().includes(q) ||
      c.grupoEconomico.toLowerCase().includes(q) ||
      c.tecnico.toLowerCase().includes(q) ||
      (c.observacao ?? '').toLowerCase().includes(q) ||
      String(c.rns ?? '').includes(q)
    );
  }

  readonly diasVisiveis = computed<DiaAgenda[]>(() =>
    (this.resultado()?.dias ?? []).map((d) => ({
      ...d,
      compromissos: d.compromissos.filter((c) => this.passa(c)),
    })),
  );

  readonly compromissosVisiveis = computed(() =>
    this.diasVisiveis().flatMap((d) => d.compromissos),
  );

  readonly totalVisivel = computed(
    () => new Set(this.compromissosVisiveis().map((c) => c.codigo)).size,
  );

  readonly horasVisiveis = computed(
    () =>
      Math.round(
        this.compromissosVisiveis().reduce((s, c) => s + c.minutos, 0) / 6,
      ) / 10,
  );

  readonly tecnicosVisiveis = computed(
    () =>
      new Set(
        this.compromissosVisiveis()
          .map((c) => c.tecnico)
          .filter(Boolean),
      ).size,
  );

  /** Resumo por status do que está VISÍVEL (as cores vêm do backend). */
  readonly resumo = computed(() => {
    const cont = new Map<string, number>();
    for (const c of this.compromissosVisiveis())
      cont.set(c.status, (cont.get(c.status) ?? 0) + 1);
    const cores = new Map(
      (this.resultado()?.resumo ?? []).map((r) => [r.status, r.cor] as const),
    );
    return [...cont.entries()]
      .map(([status, quantidade]) => ({
        status,
        quantidade,
        cor: cores.get(status) ?? '#CCCCCC',
      }))
      .sort((a, b) => a.status.localeCompare(b.status, 'pt-BR'));
  });

  readonly qtdFiltrosAtivos = computed(
    () =>
      (this.minhasAgendas() ? 0 : this.responsaveisSel().length) +
      this.statusSel().length +
      this.especiesSel().length +
      (this.busca().trim() ? 1 : 0),
  );

  /** Espécies presentes na JANELA carregada (não só no visível — senão marcar uma espécie
   * faria as outras sumirem do filtro). Valor = código; rótulo = descrição do SICLA. */
  readonly especieOpcoes = computed(() => {
    const mapa = new Map<number, string>();
    for (const d of this.resultado()?.dias ?? [])
      for (const c of d.compromissos)
        if (c.especie) mapa.set(c.especie, c.especieDes || `Espécie ${c.especie}`);
    return [...mapa.entries()]
      .map(([especie, rotulo]) => ({ valor: String(especie), rotulo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  });

  /** Usuários da tabela que passam na busca do próprio filtro (são ~250 ativos). */
  readonly usuariosVisiveis = computed(() => {
    const q = normalizarNome(this.buscaTecnico());
    const lista = this.usuarios();
    return q ? lista.filter((u) => normalizarNome(u.nome).includes(q)) : lista;
  });

  /** Grade mensal: linhas de 7 células, alinhadas pelo dia da semana (nulos nas pontas). */
  readonly semanasMes = computed<(DiaAgenda | null)[][]>(() => {
    const dias = this.diasVisiveis();
    if (dias.length === 0) return [];
    const celulas: (DiaAgenda | null)[] = [
      ...Array<null>(dias[0].diaSemana).fill(null),
      ...dias,
    ];
    while (celulas.length % 7 !== 0) celulas.push(null);
    const semanas: (DiaAgenda | null)[][] = [];
    for (let i = 0; i < celulas.length; i += 7)
      semanas.push(celulas.slice(i, i + 7));
    return semanas;
  });

  readonly diaDetalhe = computed<DiaAgenda | null>(
    () => this.diasVisiveis().find((d) => d.dia === this.referencia()) ?? null,
  );

  readonly rotuloPeriodo = computed(() => {
    const { ini, fim } = this.intervalo();
    const [aI, mI, dI] = ini.split('-').map(Number);
    const [aF, mF, dF] = fim.split('-').map(Number);
    if (this.visao() === 'dia') {
      return `${NOMES_DIA[parseIso(ini).getUTCDay()]}, ${dI} de ${NOMES_MES[mI]} de ${aI}`;
    }
    if (this.visao() === 'mes') return `${NOMES_MES[mI]} de ${aI}`;
    if (aI !== aF)
      return `${dI} de ${NOMES_MES[mI]} de ${aI} – ${dF} de ${NOMES_MES[mF]} de ${aF}`;
    if (mI !== mF)
      return `${dI} de ${NOMES_MES[mI]} – ${dF} de ${NOMES_MES[mF]} de ${aF}`;
    return `${dI} – ${dF} de ${NOMES_MES[mI]} de ${aI}`;
  });

  // ── Navegação ──────────────────────────────────────────────────────────────────────

  async definirVisao(v: VisaoAgenda): Promise<void> {
    if (v === this.visao()) return;
    this.visao.set(v);
    await this.carregar();
  }

  async navegar(passo: number): Promise<void> {
    const ref = this.referencia();
    if (this.visao() === 'dia') this.referencia.set(addDias(ref, passo));
    else if (this.visao() === 'semana')
      this.referencia.set(addDias(ref, passo * 7));
    else {
      const [ano, mes] = ref.split('-').map(Number);
      const total = ano * 12 + (mes - 1) + passo;
      this.referencia.set(
        `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`,
      );
    }
    await this.carregar();
  }

  async irHoje(): Promise<void> {
    this.referencia.set(hojeIsoLocal());
    await this.carregar();
  }

  /** Clique num dia da grade mensal abre aquele dia em detalhe. */
  async abrirDia(d: DiaAgenda | null): Promise<void> {
    if (!d) return;
    this.referencia.set(d.dia);
    this.visao.set('dia');
    await this.carregar();
  }

  // ── Detalhe do compromisso (modal) ─────────────────────────────────────────────────

  /** Clique num compromisso (visões semana e dia): abre o modal com os dados da AGENDA —
   * horário, duração, espécie, status e observação, no mesmo desenho do cartão "Agendas
   * do Técnico" do BI Alocação (pedido do usuário em 2026-08-18). Se houver RNS
   * vinculada, o resumo completo dela (a ficha da tela Execução → RNS) carrega abaixo. */
  async abrirCompromisso(c: CompromissoAgenda): Promise<void> {
    this.compromissoAberto.set(c);
    this.rnsDetalhe.set(null);
    this.rnsErro.set(null);
    if (!c.rns) {
      this.rnsCarregando.set(false);
      return;
    }
    this.rnsCarregando.set(true);
    try {
      const r = await this.rnsService.detalhar(c.rns);
      this.rnsDetalhe.set(r);
      if (r.erro) this.rnsErro.set(r.erro);
    } catch {
      this.rnsErro.set(
        'Não foi possível buscar o resumo da RNS. Verifique a conexão (e a sua permissão no módulo RNS) e tente de novo.',
      );
    } finally {
      this.rnsCarregando.set(false);
    }
  }

  fecharCompromisso(): void {
    this.compromissoAberto.set(null);
    this.rnsDetalhe.set(null);
    this.rnsErro.set(null);
    this.rnsCarregando.set(false);
  }

  // ── Ajuda do template ──────────────────────────────────────────────────────────────

  /** Grafia do usuário logado NA TABELA de usuários — é a que bate com o `TECNICO` do
   * SICLA. Sem correspondente na tabela, fica o nome do próprio login. */
  private nomeNaTabela(): string {
    const meu = this.auth.usuario()?.nome ?? '';
    return this.usuarios().find((u) => mesmoNome(u.nome, meu))?.nome ?? meu;
  }

  verMinhas(): void {
    const meu = this.nomeNaTabela();
    this.responsaveisSel.set(meu ? [meu] : []);
  }

  verTodas(): void {
    this.responsaveisSel.set([]);
  }

  alternar(selecao: WritableSignal<string[]>, valor: string): void {
    selecao.update((v) =>
      v.includes(valor) ? v.filter((x) => x !== valor) : [...v, valor],
    );
  }

  marcado(selecao: WritableSignal<string[]>, valor: string): boolean {
    return selecao().includes(valor);
  }

  limparFiltros(): void {
    this.responsaveisSel.set([]);
    this.buscaTecnico.set('');
    this.statusSel.set([]);
    this.especiesSel.set([]);
    this.busca.set('');
  }

  rotuloDia(diaSemana: number): string {
    return ROTULO_DIA[diaSemana] ?? '';
  }

  corBorda(status: string): string {
    return COR_BORDA[status] ?? '#9e9e9e';
  }

  rotuloStatus(status: string): string {
    const p = (status ?? '').split('-');
    return p.length > 1 ? p.slice(1).join('-') : status;
  }

  /** "50m", "2h", "2h 30m" — mesmo formato dos calendários de BI. */
  duracao(minutos: number): string {
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  private faixaCriticidade(minutos: number) {
    return (
      CRITICIDADE.find((f) => minutos < f.ate) ?? CRITICIDADE[CRITICIDADE.length - 1]
    );
  }

  criticidade(minutos: number): string {
    return this.faixaCriticidade(minutos).rotulo;
  }

  corCriticidade(minutos: number): string {
    return this.faixaCriticidade(minutos).cor;
  }

  dataBr(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  ehHoje(dia: string): boolean {
    return dia === hojeIsoLocal();
  }

  dicaDe(c: CompromissoAgenda): string {
    const partes = [
      `${c.horaIni}–${c.horaFim} · ${this.duracao(c.minutos)}`,
      c.tecnico,
      c.fantasia,
      this.rotuloStatus(c.status),
      c.assunto,
      c.rns
        ? `RNS ${c.rns} — clique para ver a agenda e o resumo da RNS`
        : 'Clique para ver os detalhes da agenda',
    ];
    return partes.filter(Boolean).join('\n');
  }
}
