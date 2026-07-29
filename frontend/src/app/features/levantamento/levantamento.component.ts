import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LevantamentoService } from '../../core/services/levantamento.service';
import { ProjetosService } from '../../core/services/projetos.service';
import {
  LevantamentoRespostaLinha,
  LevantamentoResumo,
  PresencaLevantamento,
  TEXTO_NAO_UTILIZADO,
} from '../../core/models/levantamento.model';

// Espelha _SIGLA_BLOCOS/_BLOCO_DISPLAY/area_do_modulo de webapp/gl_comum.py.
const AREA_DO_MODULO: Record<string, string> = {
  FAT: 'Vendas e Faturamento',
  PDV: 'Vendas e Faturamento',
  OSE: 'Vendas e Faturamento',
  SAC: 'Vendas e Faturamento',
  GIN: 'Produção',
  GCA: 'Produção',
  EST: 'Compras / Estoque',
  COM: 'Compras / Estoque',
  TLO: 'Compras / Estoque',
  FIN: 'Gestão Financeira',
  GCO: 'Gestão Financeira',
  CTB: 'Gestão Fiscal, Contábil e Patrimonial',
  LFI: 'Gestão Fiscal, Contábil e Patrimonial',
  GPA: 'Gestão Fiscal, Contábil e Patrimonial',
  AUE: 'Gestão Fiscal, Contábil e Patrimonial',
  FPA: 'Folha de Pagamento',
  PWC: 'Portais',
  PGP: 'Portais',
  RHU: 'RHU',
};

function areaDoModulo(sigla: string, modulo: string): string {
  return AREA_DO_MODULO[(sigla || '').toUpperCase()] || modulo || sigla || 'Outros';
}

/** De quanto em quanto tempo a tela publica onde este técnico está e busca o que os outros
 * gravaram. 5s é o compromisso: rápido o bastante para dois técnicos não se atropelarem,
 * leve o bastante para a rede interna (o tique só traz o que MUDOU desde o anterior). */
const INTERVALO_SYNC_MS = 5000;
/** Silêncio no teclado que dispara o autosave do campo. */
const ESPERA_DIGITACAO_MS = 900;

export type EstadoLinha = 'salvando' | 'salvo' | 'erro';

export interface ItemLevantamentoRender extends LevantamentoRespostaLinha {
  mostrarModulo: boolean;
  mostrarAdicional: boolean;
  /** Sem resposta e sem a flag "Não será utilizado." — é o que falta para concluir. */
  pendente: boolean;
}

export interface GrupoLevantamentoRender {
  area: string;
  itens: ItemLevantamentoRender[];
  resp: number;
  faltam: number;
}

@Component({
  selector: 'app-levantamento',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './levantamento.component.html',
  styleUrl: './levantamento.component.css',
})
export class LevantamentoComponent implements OnDestroy {
  private readonly service = inject(LevantamentoService);
  private readonly projetos = inject(ProjetosService);
  private readonly route = inject(ActivatedRoute);
  private readonly doc = inject(DOCUMENT);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly salvo = signal(false);
  readonly cliente = signal('');
  readonly linhas = signal<LevantamentoRespostaLinha[]>([]);
  readonly resumo = signal<LevantamentoResumo>({ respondidas: 0, total: 0 });

  /** Outros técnicos com esta mesma tela aberta agora. */
  readonly presentes = signal<PresencaLevantamento[]>([]);
  /** Situação do autosave campo a campo. */
  readonly estadoLinha = signal<Record<number, EstadoLinha>>({});
  /** Recado de edição simultânea (o colega gravou por cima) — some no próximo salvamento. */
  readonly aviso = signal<string | null>(null);
  /** Só passa a marcar os campos vazios em vermelho depois da 1ª tentativa de concluir —
   * abrir a tela com tudo em vermelho não ajuda ninguém. */
  readonly cobrarPendentes = signal(false);

  private readonly focoLinha = signal<number | null>(null);

  /** Ids com texto digitado ainda não confirmado pelo servidor. O tique NUNCA sobrescreve
   * estes — seria puxar o tapete de quem está digitando. */
  private readonly sujas = new Set<number>();
  private readonly debounces = new Map<number, ReturnType<typeof setTimeout>>();
  private timerSync?: ReturnType<typeof setInterval>;
  /** Relógio do servidor no último tique — filtro do próximo. */
  private desde?: string;

  readonly progresso = computed(() => {
    const { respondidas, total } = this.resumo();
    return total ? Math.round((respondidas / total) * 100) : 0;
  });

  readonly faltam = computed(
    () => this.linhas().filter((l) => !l.naoUtilizado && !(l.resposta || '').trim()).length,
  );

  /** linhaId -> nomes de quem está com o cursor naquela pergunta agora. */
  readonly editores = computed(() => {
    const m = new Map<number, string[]>();
    for (const p of this.presentes()) {
      if (p.linhaId == null) continue;
      const nomes = m.get(p.linhaId) ?? [];
      nomes.push(p.nome);
      m.set(p.linhaId, nomes);
    }
    return m;
  });

  readonly grupos = computed<GrupoLevantamentoRender[]>(() => {
    const porArea = new Map<string, { g: GrupoLevantamentoRender; modAnterior: string | null; adicAnterior: string | null }>();
    const lista: GrupoLevantamentoRender[] = [];
    for (const r of this.linhas()) {
      const area = areaDoModulo(r.moduloSigla, r.modulo);
      let ctrl = porArea.get(area);
      if (!ctrl) {
        ctrl = { g: { area, itens: [], resp: 0, faltam: 0 }, modAnterior: null, adicAnterior: null };
        porArea.set(area, ctrl);
        lista.push(ctrl.g);
      }
      const mostrarModulo = r.moduloSigla !== ctrl.modAnterior;
      if (mostrarModulo) {
        ctrl.modAnterior = r.moduloSigla;
        ctrl.adicAnterior = null;
      }
      const mostrarAdicional = !!r.adicional && r.adicional !== ctrl.adicAnterior;
      if (mostrarAdicional) ctrl.adicAnterior = r.adicional;
      const respondida = !!(r.resposta || '').trim();
      ctrl.g.itens.push({
        ...r,
        mostrarModulo,
        mostrarAdicional,
        pendente: !r.naoUtilizado && !respondida,
      });
      if (respondida) ctrl.g.resp++;
      else if (!r.naoUtilizado) ctrl.g.faltam++;
    }
    return lista;
  });

  constructor() {
    void this.carregar();
  }

  ngOnDestroy(): void {
    for (const t of this.debounces.values()) clearTimeout(t);
    this.debounces.clear();
    if (this.timerSync) clearInterval(this.timerSync);
    // Best-effort: some da lista do colega na hora em vez de esperar o TTL do servidor.
    void this.service.sair(this.projetoId).catch(() => undefined);
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [projeto, dados] = await Promise.all([
        this.projetos.buscar(this.projetoId),
        this.service.obter(this.projetoId),
      ]);
      this.cliente.set(projeto.cliente);
      this.linhas.set(dados.linhas);
      this.resumo.set(dados.resumo);
      this.iniciarSincronizacao();
    } catch {
      this.erro.set('Não foi possível carregar o levantamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  // ——— edição a várias mãos ———————————————————————————————————————————————

  private iniciarSincronizacao(): void {
    if (this.timerSync) return;
    void this.tique();
    this.timerSync = setInterval(() => void this.tique(), INTERVALO_SYNC_MS);
  }

  /** Publica a presença deste técnico e aplica o que os outros gravaram desde o último tique. */
  private async tique(): Promise<void> {
    try {
      const s = await this.service.sincronizar(this.projetoId, {
        linhaId: this.focoLinha(),
        desde: this.desde,
      });
      this.desde = s.agora;
      this.presentes.set(s.presentes);
      this.resumo.set(s.resumo);
      if (s.linhas.length > 0) this.mesclar(s.linhas);
    } catch {
      // Tique é best-effort: se a rede oscilou, o próximo resolve. Encher a tela de erro
      // vermelho a cada 5s por causa disso seria pior que o problema.
    }
  }

  /** Aplica as linhas que vieram do servidor, preservando o que está sendo digitado aqui.
   * Campo sujo fica de fora: quando ele for gravado, o backend responde 409 (a versão dele
   * está velha) e aí sim a tela resolve o conflito mostrando os dois textos. */
  private mesclar(recebidas: LevantamentoRespostaLinha[]): void {
    const porId = new Map(recebidas.map((l) => [l.id, l]));
    let mudou = false;
    const atualizadas = this.linhas().map((l) => {
      const nova = porId.get(l.id);
      if (!nova || this.sujas.has(l.id)) return l;
      if (nova.versao === l.versao) return l;
      mudou = true;
      return nova;
    });
    if (mudou) this.linhas.set(atualizadas);
  }

  // ——— preenchimento ——————————————————————————————————————————————————————

  onRespostaChange(id: number, valor: string): void {
    this.atualizarLocal(id, { resposta: valor });
    this.sujas.add(id);
    this.salvo.set(false);
    this.agendarGravacao(id);
  }

  onFoco(id: number): void {
    this.focoLinha.set(id);
  }

  /** Sair do campo grava na hora — não faz sentido esperar o debounce de quem já terminou. */
  onBlur(id: number): void {
    if (this.focoLinha() === id) this.focoLinha.set(null);
    if (this.sujas.has(id)) this.gravarAgora(id);
  }

  /** "Não será utilizado.": preenche com a frase padrão e tranca o campo. Desmarcando,
   * limpa a frase (o campo volta a ser obrigatório) mas preserva texto que o técnico tenha
   * digitado antes de marcar. */
  onNaoUtilizado(id: number, marcado: boolean): void {
    const linha = this.linhas().find((l) => l.id === id);
    if (!linha) return;
    this.cancelarDebounce(id);
    const resposta = marcado
      ? TEXTO_NAO_UTILIZADO
      : linha.resposta === TEXTO_NAO_UTILIZADO
        ? ''
        : linha.resposta;
    this.atualizarLocal(id, { naoUtilizado: marcado, resposta });
    this.sujas.delete(id);
    this.salvo.set(false);
    void this.gravar(id, { naoUtilizado: marcado, resposta });
  }

  private agendarGravacao(id: number): void {
    this.cancelarDebounce(id);
    this.debounces.set(
      id,
      setTimeout(() => this.gravarAgora(id), ESPERA_DIGITACAO_MS),
    );
  }

  private cancelarDebounce(id: number): void {
    const t = this.debounces.get(id);
    if (t) clearTimeout(t);
    this.debounces.delete(id);
  }

  private gravarAgora(id: number): void {
    this.cancelarDebounce(id);
    const linha = this.linhas().find((l) => l.id === id);
    if (!linha) return;
    void this.gravar(id, { resposta: linha.resposta });
  }

  /** Autosave de um campo, com a versão que estava em tela (o backend recusa se envelheceu). */
  private async gravar(
    id: number,
    dados: { resposta?: string; naoUtilizado?: boolean },
  ): Promise<void> {
    const linha = this.linhas().find((l) => l.id === id);
    if (!linha) return;
    const enviado = dados.resposta;
    this.marcarEstado(id, 'salvando');
    try {
      const { linha: salva, resumo } = await this.service.salvarLinha(this.projetoId, id, {
        ...dados,
        versao: linha.versao,
      });
      // A pessoa pode ter continuado digitando durante a requisição: nesse caso só a versão
      // e a autoria são aproveitadas, o texto em tela é o que vale.
      const atual = this.linhas().find((l) => l.id === id);
      const aindaDigitando =
        enviado !== undefined && !!atual && atual.resposta !== enviado;
      this.linhas.set(
        this.linhas().map((l) =>
          l.id === id ? { ...salva, resposta: aindaDigitando ? l.resposta : salva.resposta } : l,
        ),
      );
      if (!aindaDigitando) this.sujas.delete(id);
      this.resumo.set(resumo);
      this.marcarEstado(id, 'salvo');
      this.erro.set(null);
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) {
        await this.resolverConflito(id, enviado ?? '', e);
        return;
      }
      this.marcarEstado(id, 'erro');
      this.erro.set('Não foi possível salvar esta resposta. Verifique a conexão.');
    }
  }

  /** Outro técnico gravou esta pergunta antes. A versão dele fica no campo (é a que está no
   * banco) e o texto local vai para o aviso, para o autor decidir o que fazer — descartar
   * calado o que a pessoa digitou seria pior que a colisão. */
  private async resolverConflito(
    id: number,
    textoLocal: string,
    e: HttpErrorResponse,
  ): Promise<void> {
    this.sujas.delete(id);
    const msg =
      (e.error as { message?: string } | null)?.message ??
      'Esta resposta foi alterada por outro técnico.';
    try {
      const dados = await this.service.obter(this.projetoId);
      this.mesclar(dados.linhas);
      this.resumo.set(dados.resumo);
    } catch {
      // Sem o estado do servidor o aviso já basta — o próximo tique recarrega.
    }
    const topico = this.linhas().find((l) => l.id === id)?.topico ?? '';
    this.aviso.set(
      textoLocal.trim()
        ? `${msg} Em "${topico}", o que você havia digitado foi: «${textoLocal.trim()}»`
        : msg,
    );
    this.marcarEstado(id, 'erro');
  }

  private atualizarLocal(id: number, campos: Partial<LevantamentoRespostaLinha>): void {
    this.linhas.set(this.linhas().map((l) => (l.id === id ? { ...l, ...campos } : l)));
  }

  private marcarEstado(id: number, estado: EstadoLinha): void {
    this.estadoLinha.set({ ...this.estadoLinha(), [id]: estado });
  }

  // ——— conclusão ————————————————————————————————————————————————————————

  /** O botão continua existindo como rede de segurança (grava tudo de uma vez) e é onde a
   * obrigatoriedade é cobrada: com pergunta em branco, avisa e leva até a primeira. */
  async salvar(): Promise<void> {
    for (const id of [...this.debounces.keys()]) this.gravarAgora(id);
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const respostas: Record<string, string> = {};
      for (const l of this.linhas()) if (!l.naoUtilizado) respostas[String(l.id)] = l.resposta;
      const respondidas = await this.service.salvar(this.projetoId, respostas);
      this.resumo.set({ respondidas, total: this.linhas().length });
      const pendentes = this.faltam();
      this.cobrarPendentes.set(pendentes > 0);
      this.salvo.set(pendentes === 0);
      if (pendentes > 0) this.irParaPendente();
    } catch {
      this.erro.set('Não foi possível salvar as respostas.');
    } finally {
      this.salvando.set(false);
    }
  }

  /** Abre o bloco da primeira pergunta em branco e rola até ela. */
  irParaPendente(): void {
    this.cobrarPendentes.set(true);
    const alvo = this.linhas().find((l) => !l.naoUtilizado && !(l.resposta || '').trim());
    if (!alvo) return;
    const campo = this.doc.getElementById(`lev-campo-${alvo.id}`);
    if (!campo) return;
    campo.closest('details')?.setAttribute('open', '');
    campo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (campo as HTMLTextAreaElement).focus({ preventScroll: true });
  }
}
