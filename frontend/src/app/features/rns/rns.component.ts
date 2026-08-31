import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Chart, ChartConfiguration, Plugin } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import { RnsService } from '../../core/services/rns.service';
import { LinhaRns, ResultadoConsultaRns } from '../../core/models/rns.model';
import { deSignal, filtrosSalvos } from '../../core/utils/filtros-salvos';
import { RnsDetalheComponent } from './rns-detalhe.component';

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

/** Rótulo da fatia de RNS sem tipo preenchido no SICLA — não existe no filtro de Tipo,
 * então a fatia aparece no gráfico mas não filtra a lista. */
const SEM_TIPO = '(sem tipo)';

/** Paleta categórica validada (banda de luminosidade, separação para daltonismo e piso de
 * visão normal — script da skill de dataviz, modo claro). A ORDEM é o mecanismo de
 * segurança: fatias vizinhas continuam distinguíveis; não reordenar por estética. */
const CORES_TIPO = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
];
/** Do 9º tipo em diante (e para o "(sem tipo)"): cinza neutro, nunca uma cor nova. */
const COR_TIPO_DEMAIS = '#78909c';

/** Tinta legível SOBRE a fatia: escura em fatia clara (amarelo, rosa), branca no resto. */
function tintaSobre(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#1f2937' : '#ffffff';
}

/** Escreve a QUANTIDADE dentro de cada fatia — mesma decisão dos gráficos do BI (pedido do
 * usuário em 2026-08-17: enxergar os números sem depender do tooltip). Fatia estreita fica
 * sem rótulo para não virar borrão; o tooltip e a legenda cobrem. */
const ROTULOS_NA_PIZZA: Plugin<'pie'> = {
  id: 'rotulosNaPizza',
  afterDatasetsDraw(chart: Chart<'pie'>) {
    const meta = chart.getDatasetMeta(0);
    const dados = (chart.data.datasets[0]?.data ?? []) as number[];
    const cores = (chart.data.datasets[0]?.backgroundColor ?? []) as string[];
    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 12px system-ui, sans-serif';
    meta.data.forEach((el, i) => {
      const arco = el as unknown as {
        x: number; y: number; startAngle: number; endAngle: number;
        innerRadius: number; outerRadius: number;
      };
      const v = Number(dados[i] ?? 0);
      if (!v || arco.endAngle - arco.startAngle < 0.28) return;
      const ang = (arco.startAngle + arco.endAngle) / 2;
      const r = (arco.innerRadius + arco.outerRadius) / 2;
      ctx.fillStyle = tintaSobre(cores[i] ?? COR_TIPO_DEMAIS);
      ctx.fillText(
        v.toLocaleString('pt-BR'),
        arco.x + Math.cos(ang) * r,
        arco.y + Math.sin(ang) * r,
      );
    });
    ctx.restore();
  },
};

/** Tela **Execução → RNS** — consulta de assuntos nas RNS do SICLA, no molde do Dicionário
 * Inteligente: o consultor pesquisa um assunto qualquer e a lista reduz na hora às RNS
 * relacionadas (Pedido + Item). O backend entrega o período inteiro (janela de criação);
 * busca e filtros são em memória. A ordem das linhas é a do SICLA (backlog/prioridade) —
 * a tela não reordena de propósito: essa ordem é a fila de trabalho. */
@Component({
  selector: 'app-rns',
  standalone: true,
  imports: [FormsModule, DecimalPipe, ChartDirective, RnsDetalheComponent],
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
  readonly clienteSel = signal('');
  readonly statusSel = signal('');
  readonly tipoSel = signal('');

  /** Chave `pedido/item` da linha com o detalhe aberto (uma por vez — o detalhe é longo). */
  readonly aberta = signal<string | null>(null);

  /** Painel do gráfico de pizza (RNS por tipo) aberto? Persiste por usuário. */
  readonly graficoAberto = signal(false);

  constructor() {
    // Busca e filtros salvos por usuário logado (o período não: é contextual por natureza).
    filtrosSalvos('rns', {
      busca: deSignal(this.busca),
      clienteSel: deSignal(this.clienteSel),
      statusSel: deSignal(this.statusSel),
      tipoSel: deSignal(this.tipoSel),
      graficoAberto: deSignal(this.graficoAberto),
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
          l.detalhamento,
          l.motivo,
          l.parecerEng,
        ]
          .filter((v) => v !== null && v !== '')
          .join(' '),
      ),
    })),
  );

  readonly clienteOpcoes = computed(() =>
    [...new Set((this.resultado()?.itens ?? []).map((l) => l.fantasia).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR'),
    ),
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
    const cliente = this.clienteSel();
    const status = this.statusSel();
    const tipo = this.tipoSel();
    return this.indexadas()
      .filter(({ linha, alvo }) => {
        if (cliente && linha.fantasia !== cliente) return false;
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
    return !!(this.busca().trim() || this.clienteSel() || this.statusSel() || this.tipoSel());
  }

  limparFiltros(): void {
    this.busca.set('');
    this.clienteSel.set('');
    this.statusSel.set('');
    this.tipoSel.set('');
  }

  // ── Gráfico de pizza: RNS por tipo ─────────────────────────────────────────────────

  /** Contagem por tipo das linhas VISÍVEIS (mesma regra dos painéis do BI: o gráfico
   * responde à busca e aos filtros). Fatias na ordem do select de Tipo — a cor segue o
   * TIPO, não a posição, então filtrar não repinta as fatias que sobram. */
  readonly porTipoVisivel = computed(() => {
    const mapa = new Map<string, number>();
    for (const l of this.visiveis()) {
      const k = l.tipoDes || SEM_TIPO;
      mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
    const fatias = this.tipoOpcoes()
      .filter((t) => mapa.has(t))
      .map((t) => ({ tipo: t, quantidade: mapa.get(t)! }));
    if (mapa.has(SEM_TIPO)) fatias.push({ tipo: SEM_TIPO, quantidade: mapa.get(SEM_TIPO)! });
    return fatias;
  });

  /** Cor fixa por tipo, pelo índice na lista completa do período carregado. */
  corTipo(tipo: string): string {
    const i = this.tipoOpcoes().indexOf(tipo);
    return i >= 0 && i < CORES_TIPO.length ? CORES_TIPO[i] : COR_TIPO_DEMAIS;
  }

  /** Clique na fatia (ou na legenda) filtra a lista pelo tipo; de novo, desfaz. */
  filtrarPorTipo(tipo: string): void {
    if (!this.tipoOpcoes().includes(tipo)) return; // "(sem tipo)" não existe no filtro
    this.tipoSel.update((atual) => (atual === tipo ? '' : tipo));
  }

  readonly graficoTipos = computed<ChartConfiguration<'pie'> | null>(() => {
    const dados = this.porTipoVisivel();
    if (dados.length === 0) return null;
    const total = dados.reduce((s, d) => s + d.quantidade, 0);
    return {
      type: 'pie',
      data: {
        labels: dados.map((d) => d.tipo),
        datasets: [
          {
            data: dados.map((d) => d.quantidade),
            backgroundColor: dados.map((d) => this.corTipo(d.tipo)),
            // Respiro entre fatias vizinhas (a separação não fica só na cor).
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      plugins: [ROTULOS_NA_PIZZA],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt, elems) => {
          const d = dados[elems[0]?.index ?? -1];
          if (d) this.filtrarPorTipo(d.tipo);
        },
        plugins: {
          legend: {
            position: 'bottom',
            // O padrão do Chart.js só ESCONDE a fatia — aqui o clique filtra de verdade.
            onClick: (_evt, item) => {
              const d = dados[item.index ?? -1];
              if (d) this.filtrarPorTipo(d.tipo);
            },
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                const d = dados[item.dataIndex];
                const pct = total ? Math.round((d.quantidade / total) * 100) : 0;
                return ` ${d.quantidade.toLocaleString('pt-BR')} RNS (${pct}%)`;
              },
            },
          },
        },
      },
    };
  });

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
