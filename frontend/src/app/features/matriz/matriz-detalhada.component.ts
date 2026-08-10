import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js/auto';
import { ChartDirective } from '../../core/directives/chart.directive';
import {
  FichaMatrizDetalhada,
  ListaMatrizDetalhada,
  MatrizDetalhadaService,
  MenuComNota,
  ModuloComNotas,
} from '../../core/services/matriz-detalhada.service';
import { deSignal, filtrosSalvos } from '../../core/utils/filtros-salvos';

/** Matriz de Conhecimento — DETALHADA (por menu do SIGER). Notas por menu (código de acesso);
 * a nota do módulo é a média dos menus avaliados. Taxonomia vem do Dicionário. Mesmas regras
 * de permissão da Matriz clássica. */
@Component({
  selector: 'app-matriz-detalhada',
  standalone: true,
  imports: [FormsModule, RouterLink, NgTemplateOutlet, ChartDirective],
  templateUrl: './matriz-detalhada.component.html',
  styleUrl: './matriz-detalhada.component.css',
})
export class MatrizDetalhadaComponent {
  private readonly api = inject(MatrizDetalhadaService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly salvo = signal(false);

  readonly tecnicos = signal<ListaMatrizDetalhada['tecnicos']>([]);
  readonly podeVerTodos = signal(false);
  readonly tecnicoId = signal<number | null>(null);

  readonly tecnico = signal<FichaMatrizDetalhada['tecnico'] | null>(null);
  readonly modulos = signal<ModuloComNotas[]>([]);
  readonly resumo = signal<FichaMatrizDetalhada['resumo']>({ media: null, avaliadas: 0, total: 0 });
  readonly editavel = signal(false);

  readonly abertos = signal<Set<string>>(new Set());
  /** Notas alteradas ainda não salvas: "SIGLA|codigo" -> string. */
  private readonly alterados = new Map<string, string>();
  readonly temAlteracao = signal(false);

  readonly modulosLista = computed(() =>
    this.modulos().filter((m) => m.tipo === 'modulo'),
  );
  readonly adicionaisLista = computed(() =>
    this.modulos().filter((m) => m.tipo === 'adicional'),
  );

  // ── Busca de módulos/adicionais ─────────────────────────────────────
  readonly filtro = signal('');
  private norm(s: string): string {
    return (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }
  private casa(m: ModuloComNotas): boolean {
    const q = this.norm(this.filtro().trim());
    if (!q) return true;
    return this.norm(m.sigla).includes(q) || this.norm(m.titulo).includes(q);
  }
  readonly modulosFiltrados = computed(() =>
    this.modulosLista().filter((m) => this.casa(m)),
  );
  readonly adicionaisFiltrados = computed(() =>
    this.adicionaisLista().filter((m) => this.casa(m)),
  );
  readonly semResultado = computed(
    () =>
      !!this.filtro().trim() &&
      this.modulosFiltrados().length === 0 &&
      this.adicionaisFiltrados().length === 0,
  );

  // ── Gráfico "Média por módulo" (do TÉCNICO SELECIONADO) ────────────
  readonly mostrarGrafico = signal(false);

  /** Itens do gráfico: módulos primeiro, depois adicionais, só os que têm média. Sai de
   * `modulos()` — a ficha JÁ carregada do técnico selecionado —, então o gráfico segue a
   * seleção sozinho (trocar de técnico recarrega a ficha) e acompanha em tempo real as
   * notas editadas na tela, sem uma segunda chamada à API. Era a média GERAL de todos os
   * técnicos (`/medias-gerais`) até 2026-07-28. */
  private readonly itensGrafico = computed(() => {
    const mods = this.modulos();
    return [
      ...mods.filter((m) => m.tipo === 'modulo'),
      ...mods.filter((m) => m.tipo === 'adicional'),
    ].filter((m) => m.media != null);
  });
  readonly graficoAltura = computed(() =>
    Math.max(300, this.itensGrafico().length * 30 + 40),
  );

  /** Plugin inline: escreve o valor da média em cada barra (dentro quando cabe; fora, na
   * cor da barra, quando a barra é curta). Sem dependência externa. */
  private readonly pluginValores = {
    id: 'valoresNaBarra',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterDatasetsDraw: (chart: any) => {
      const ctx: CanvasRenderingContext2D = chart.ctx;
      const ds = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      meta.data.forEach((bar: any, i: number) => {
        const v = ds.data[i];
        if (v == null) return;
        const txt = String(v).replace('.', ',');
        if (bar.x - bar.base >= 26) {
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'right';
          ctx.fillText(txt, bar.x - 7, bar.y);
        } else {
          ctx.fillStyle = ds.backgroundColor[i] ?? '#475569';
          ctx.textAlign = 'left';
          ctx.fillText(txt, bar.x + 5, bar.y);
        }
      });
      ctx.restore();
    },
  };

  readonly graficoConfig = computed<ChartConfiguration | null>(() => {
    const itens = this.itensGrafico();
    if (!itens.length) return null;
    const cor = (n: number) =>
      n >= 8 ? '#16a34a' : n >= 5 ? '#d97706' : '#dc2626';
    return {
      type: 'bar',
      plugins: [this.pluginValores],
      data: {
        labels: itens.map(
          (m) => `${m.sigla}${m.tipo === 'adicional' ? ' ·adic' : ''}`,
        ),
        datasets: [
          {
            label: 'Média do técnico',
            data: itens.map((m) => m.media as number),
            backgroundColor: itens.map((m) => cor(m.media as number)),
            borderRadius: 5,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const m = itens[c.dataIndex];
                return ` ${m.titulo}: ${c.parsed.x} (${m.avaliadas} de ${m.total} menus avaliados)`;
              },
            },
          },
        },
        scales: {
          x: {
            min: 0,
            max: 10,
            ticks: { stepSize: 2 },
            grid: { color: '#E2E8F0' },
          },
          y: { grid: { display: false } },
        },
      },
    };
  });

  /** Só abre o modal: os dados já estão em memória (a ficha do técnico selecionado). */
  abrirGrafico(): void {
    this.mostrarGrafico.set(true);
  }
  fecharGrafico(): void {
    this.mostrarGrafico.set(false);
  }

  constructor() {
    // Busca de módulos salva por usuário logado (filtra em memória — nada a recarregar).
    filtrosSalvos('matriz-detalhada', { filtro: deSignal(this.filtro) });
    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.api.lista();
      this.tecnicos.set(lista.tecnicos);
      this.podeVerTodos.set(lista.podeVerTodos);
      const alvo = lista.meuId ?? lista.tecnicos[0]?.id ?? null;
      this.tecnicoId.set(alvo);
      if (alvo) await this.carregarFicha(alvo);
      else this.carregando.set(false);
    } catch {
      this.erro.set('Não foi possível carregar a Matriz por menu.');
      this.carregando.set(false);
    }
  }

  async trocarTecnico(id: number): Promise<void> {
    if (this.temAlteracao() && !confirm('Há notas não salvas. Trocar de técnico e descartá-las?')) {
      return;
    }
    this.tecnicoId.set(id);
    await this.carregarFicha(id);
  }

  private async carregarFicha(id: number): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.alterados.clear();
    this.temAlteracao.set(false);
    this.salvo.set(false);
    try {
      const ficha = await this.api.ficha(id);
      this.tecnico.set(ficha.tecnico);
      this.modulos.set(ficha.modulos);
      this.resumo.set(ficha.resumo);
      this.editavel.set(ficha.editavel);
    } catch {
      this.erro.set('Não foi possível carregar a ficha.');
    } finally {
      this.carregando.set(false);
    }
  }

  toggle(sigla: string): void {
    const s = new Set(this.abertos());
    if (s.has(sigla)) s.delete(sigla);
    else s.add(sigla);
    this.abertos.set(s);
  }
  aberto(sigla: string): boolean {
    return this.abertos().has(sigla);
  }

  cls(n: number | null): string {
    if (n == null) return 's-na';
    return n >= 8 ? 's-hi' : n >= 5 ? 's-mid' : 's-lo';
  }
  nb(n: number | null): string {
    if (n == null) return '';
    return n >= 8 ? 'nb-hi' : n >= 5 ? 'nb-mid' : 'nb-lo';
  }
  fmt(n: number | null): string {
    return n == null ? '—' : n.toString().replace('.', ',');
  }
  pct(a: number, t: number): number {
    return t ? Math.round((a / t) * 100) : 0;
  }

  editar(mod: ModuloComNotas, menu: MenuComNota, valor: string): void {
    if (!this.editavel()) return;
    const v = (valor ?? '').replace(',', '.').trim();
    let nota: number | null;
    if (v === '') nota = null;
    else {
      const f = Math.round(parseFloat(v));
      if (Number.isNaN(f)) return;
      nota = Math.max(0, Math.min(10, f));
    }
    menu.nota = nota;
    this.alterados.set(menu.chave, nota == null ? '' : String(nota));
    this.temAlteracao.set(true);
    this.salvo.set(false);
    this.recalcular(mod);
    // dispara atualização dos signals (mutação in-place)
    this.modulos.set([...this.modulos()]);
  }

  private media(valores: (number | null)[]): number | null {
    const v = valores.filter((n): n is number => n != null);
    if (!v.length) return null;
    return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  }
  private recalcular(mod: ModuloComNotas): void {
    mod.avaliadas = mod.menus.filter((m) => m.nota != null).length;
    mod.media = this.media(mod.menus.map((m) => m.nota));
    const mods = this.modulos();
    this.resumo.set({
      media: this.media(mods.map((m) => m.media)),
      avaliadas: mods.reduce((a, m) => a + m.avaliadas, 0),
      total: mods.reduce((a, m) => a + m.total, 0),
    });
  }

  async salvar(): Promise<void> {
    const id = this.tecnicoId();
    if (!id || this.alterados.size === 0) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const notas: Record<string, string> = {};
      for (const [k, v] of this.alterados) notas[k] = v;
      await this.api.salvarNotas(id, notas);
      this.alterados.clear();
      this.temAlteracao.set(false);
      this.salvo.set(true);
    } catch {
      this.erro.set('Falha ao salvar. Tente novamente.');
    } finally {
      this.salvando.set(false);
    }
  }
}
