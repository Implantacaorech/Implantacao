import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RnsService } from '../../core/services/rns.service';
import { LinhaRns, ResultadoConsultaRns } from '../../core/models/rns.model';
import { deSignal, filtrosSalvos } from '../../core/utils/filtros-salvos';

/** Sem acento, caixa nem espaço duplicado — a busca por assunto tem de achar "Conversão"
 * digitando "conversao" (mesma decisão da tela Agenda para nomes do SICLA). */
function normalizar(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uma RNS com o texto de busca pré-calculado — normalizar 20 campos por linha a cada
 * tecla digitada travaria a lista com o período cheio (milhares de linhas). */
interface RnsIndexada {
  linha: LinhaRns;
  alvo: string;
}

/** Tela **Execução → RNS** — consulta de assuntos nas RNS do SICLA, no molde do Dicionário
 * Inteligente: o consultor pesquisa um assunto qualquer e a lista reduz na hora às RNS
 * relacionadas (Pedido + Item). O backend entrega o período inteiro (janela de criação);
 * busca e filtros são em memória. A ordem das linhas é a do SICLA (backlog/prioridade) —
 * a tela não reordena de propósito: essa ordem é a fila de trabalho. */
@Component({
  selector: 'app-rns',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './rns.component.html',
  styleUrl: './rns.component.css',
})
export class RnsComponent {
  private readonly service = inject(RnsService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoConsultaRns | null>(null);

  /** Janela de criação. Vazias = default do backend (mês anterior → mês seguinte); depois
   * da 1ª carga os campos mostram a janela efetiva que ele respondeu. */
  readonly ini = signal('');
  readonly fim = signal('');

  readonly busca = signal('');
  readonly statusSel = signal('');
  readonly tipoSel = signal('');

  /** Chave `pedido/item` da linha com o detalhe aberto (uma por vez — o detalhe é longo). */
  readonly aberta = signal<string | null>(null);

  constructor() {
    // Busca e filtros salvos por usuário logado (o período não: é contextual por natureza).
    filtrosSalvos('rns', {
      busca: deSignal(this.busca),
      statusSel: deSignal(this.statusSel),
      tipoSel: deSignal(this.tipoSel),
    });
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.aberta.set(null);
    try {
      const r = await this.service.consultar(
        this.ini() || undefined,
        this.fim() || undefined,
      );
      this.resultado.set(r);
      // A janela efetiva (saneada pelo backend) fica visível nos campos de data.
      this.ini.set(r.ini);
      this.fim.set(r.fim);
      if (r.erro) this.erro.set(r.erro);
    } catch {
      this.erro.set(
        'Não foi possível consultar as RNS. Verifique a conexão e tente de novo.',
      );
    } finally {
      this.carregando.set(false);
    }
  }

  async definirPeriodo(campo: 'ini' | 'fim', valor: string): Promise<void> {
    if (campo === 'ini') this.ini.set(valor);
    else this.fim.set(valor);
    await this.carregar();
  }

  // ── Busca e filtros (em memória — o backend já entregou o período inteiro) ──────────

  private readonly indexadas = computed<RnsIndexada[]>(() =>
    (this.resultado()?.itens ?? []).map((l) => ({
      linha: l,
      alvo: normalizar(
        [
          l.pedido,
          l.item,
          l.codigo,
          l.sugestao,
          l.visaoGeral,
          l.fantasia,
          l.sigla,
          l.tipoDes,
          l.subtipo,
          l.statusDes,
          l.statusPubDes,
          l.backlogDes,
          l.faseDes,
          l.requisitoDes,
          l.resNome,
          l.anaNome,
          l.funcaoDes,
          l.represenDes,
          l.productOwnerDes,
          l.celula,
          l.menu,
          l.timeDes,
          l.projeto,
          l.protocolo,
          l.contato,
        ]
          .filter((v) => v !== null && v !== '')
          .join(' '),
      ),
    })),
  );

  readonly statusOpcoes = computed(() =>
    [...new Set((this.resultado()?.itens ?? []).map((l) => l.statusDes).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR'),
    ),
  );

  readonly tipoOpcoes = computed(() =>
    [...new Set((this.resultado()?.itens ?? []).map((l) => l.tipoDes).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR'),
    ),
  );

  readonly visiveis = computed<LinhaRns[]>(() => {
    const termos = normalizar(this.busca()).split(' ').filter(Boolean);
    const status = this.statusSel();
    const tipo = this.tipoSel();
    return this.indexadas()
      .filter(({ linha, alvo }) => {
        if (status && linha.statusDes !== status) return false;
        if (tipo && linha.tipoDes !== tipo) return false;
        // Todos os termos digitados precisam aparecer (em qualquer campo) — "conversao
        // ramada" acha a RNS de conversão DO cliente Ramada, não a união das duas buscas.
        return termos.every((t) => alvo.includes(t));
      })
      .map(({ linha }) => linha);
  });

  readonly clientesVisiveis = computed(
    () =>
      new Set(this.visiveis().map((l) => l.fantasia).filter(Boolean)).size,
  );

  temFiltro(): boolean {
    return !!(this.busca().trim() || this.statusSel() || this.tipoSel());
  }

  limparFiltros(): void {
    this.busca.set('');
    this.statusSel.set('');
    this.tipoSel.set('');
  }

  // ── Detalhe ────────────────────────────────────────────────────────────────────────

  chaveDe(l: LinhaRns): string {
    return `${l.pedido ?? ''}/${l.item ?? ''}/${l.codigo ?? ''}`;
  }

  alternarDetalhe(l: LinhaRns): void {
    const chave = this.chaveDe(l);
    this.aberta.set(this.aberta() === chave ? null : chave);
  }

  estaAberta(l: LinhaRns): boolean {
    return this.aberta() === this.chaveDe(l);
  }

  // ── Ajuda do template ──────────────────────────────────────────────────────────────

  dataBr(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  ou(v: string | number | null): string {
    return v === null || v === '' ? '—' : String(v);
  }
}
