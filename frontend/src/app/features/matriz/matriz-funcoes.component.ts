import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChartConfiguration } from 'chart.js/auto';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/models/api-envelope.model';
import { ChartDirective } from '../../core/directives/chart.directive';

interface FuncaoComNota {
  codigo: string;
  descricao: string;
  menus: string;
  chave: string;
  nota: number | null;
}
interface ModuloComNotas {
  sigla: string;
  titulo: string;
  total: number;
  avaliadas: number;
  media: number | null;
  funcoes: FuncaoComNota[];
}
interface FichaResp {
  tecnico: { id: number; nome: string; setor: string; dias: string };
  modulos: ModuloComNotas[];
  resumo: { media: number | null; avaliadas: number; total: number };
  editavel: boolean;
  volta: boolean;
}
interface ListaResp {
  tecnicos: { id: number; nome: string; setor: string }[];
  meuId: number | null;
  podeVerTodos: boolean;
  podeAdmin: boolean;
}

/** Grupo de triagem — precisa ir por último e ser destacado na tela. Espelha
 * GRUPO_SEM_MODULO do backend. */
const GRUPO_CLASSIFICAR = 'Classificar';

/** Matriz por Menu — FUNÇÕES SICLA. Mesma estrutura e formato da Matriz por Menu do
 * Dicionário: nota 0-10 por item, média do módulo = média dos itens avaliados. A diferença
 * é a fonte: `SICLA.LISTA_FUNCOES`, agrupada pela coluna STRMENUS. */
@Component({
  selector: 'app-matriz-funcoes',
  standalone: true,
  imports: [FormsModule, RouterLink, ChartDirective],
  templateUrl: './matriz-funcoes.component.html',
  styleUrl: './matriz-detalhada.component.css',
})
export class MatrizFuncoesComponent {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/matriz-funcoes`;

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly salvo = signal(false);
  readonly recarregando = signal(false);

  readonly tecnicos = signal<ListaResp['tecnicos']>([]);
  readonly podeVerTodos = signal(false);
  readonly podeAdmin = signal(false);
  readonly tecnicoId = signal<number | null>(null);

  readonly tecnico = signal<FichaResp['tecnico'] | null>(null);
  readonly modulos = signal<ModuloComNotas[]>([]);
  readonly resumo = signal<FichaResp['resumo']>({
    media: null,
    avaliadas: 0,
    total: 0,
  });
  readonly editavel = signal(false);

  readonly abertos = signal<Set<string>>(new Set());
  /** Notas alteradas ainda não salvas: "SIGLA|codigo" -> string. */
  private readonly alterados = new Map<string, string>();
  readonly temAlteracao = signal(false);

  readonly ehClassificar = (sigla: string): boolean =>
    sigla === GRUPO_CLASSIFICAR;

  // ── Busca de módulos ────────────────────────────────────────────────
  readonly filtro = signal('');
  private norm(s: string): string {
    return (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }
  readonly modulosFiltrados = computed(() => {
    const q = this.norm(this.filtro().trim());
    if (!q) return this.modulos();
    return this.modulos().filter(
      (m) => this.norm(m.sigla).includes(q) || this.norm(m.titulo).includes(q),
    );
  });
  readonly semResultado = computed(
    () => !!this.filtro().trim() && this.modulosFiltrados().length === 0,
  );

  // ── Gráfico "Média por módulo" (do TÉCNICO SELECIONADO) ────────────
  readonly mostrarGrafico = signal(false);

  /** Sai de `modulos()` — a ficha já carregada —, então o gráfico segue a seleção sozinho e
   * acompanha em tempo real as notas editadas, sem uma segunda chamada à API. */
  private readonly itensGrafico = computed(() =>
    this.modulos().filter((m) => m.media != null),
  );
  readonly graficoAltura = computed(() =>
    Math.max(300, this.itensGrafico().length * 30 + 40),
  );

  /** Plugin inline: escreve o valor da média em cada barra. Mesmo da Matriz por Menu. */
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
        labels: itens.map((m) => m.sigla),
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
                return ` ${m.sigla}: ${c.parsed.x} (${m.avaliadas} de ${m.total} funções avaliadas)`;
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

  abrirGrafico(): void {
    this.mostrarGrafico.set(true);
  }
  fecharGrafico(): void {
    this.mostrarGrafico.set(false);
  }

  constructor() {
    void this.iniciar();
  }

  /** Mensagem do backend quando o SICLA está fora (503) — melhor que "erro genérico". */
  private mensagemErro(e: unknown, padrao: string): string {
    if (e instanceof HttpErrorResponse && typeof e.error?.message === 'string') {
      return e.error.message;
    }
    return padrao;
  }

  private async iniciar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiEnvelope<ListaResp>>(this.base),
      );
      this.tecnicos.set(res.data.tecnicos);
      this.podeVerTodos.set(res.data.podeVerTodos);
      this.podeAdmin.set(res.data.podeAdmin);
      const alvo = res.data.meuId ?? res.data.tecnicos[0]?.id ?? null;
      this.tecnicoId.set(alvo);
      if (alvo) await this.carregarFicha(alvo);
      else this.carregando.set(false);
    } catch (e) {
      this.erro.set(
        this.mensagemErro(e, 'Não foi possível carregar a Matriz por função.'),
      );
      this.carregando.set(false);
    }
  }

  async trocarTecnico(id: number): Promise<void> {
    if (
      this.temAlteracao() &&
      !confirm('Há notas não salvas. Trocar de técnico e descartá-las?')
    ) {
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
      const res = await firstValueFrom(
        this.http.get<ApiEnvelope<FichaResp>>(`${this.base}/${id}`),
      );
      this.tecnico.set(res.data.tecnico);
      this.modulos.set(res.data.modulos);
      this.resumo.set(res.data.resumo);
      this.editavel.set(res.data.editavel);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível carregar a ficha.'));
    } finally {
      this.carregando.set(false);
    }
  }

  /** Relê a LISTA_FUNCOES no SICLA descartando o cache do servidor — para quando alguém
   * cadastra uma função nova lá e ela precisa aparecer aqui sem reiniciar o Painel. */
  async recarregarDoSicla(): Promise<void> {
    if (this.recarregando()) return;
    this.recarregando.set(true);
    this.erro.set(null);
    try {
      await firstValueFrom(
        this.http.post<ApiEnvelope<{ modulos: number; funcoes: number }>>(
          `${this.base}/recarregar`,
          {},
        ),
      );
      const id = this.tecnicoId();
      if (id) await this.carregarFicha(id);
    } catch (e) {
      this.erro.set(
        this.mensagemErro(e, 'Não foi possível reler as funções no SICLA.'),
      );
    } finally {
      this.recarregando.set(false);
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

  editar(mod: ModuloComNotas, f: FuncaoComNota, valor: string): void {
    if (!this.editavel()) return;
    const v = (valor ?? '').replace(',', '.').trim();
    let nota: number | null;
    if (v === '') nota = null;
    else {
      const n = Math.round(parseFloat(v));
      if (Number.isNaN(n)) return;
      nota = Math.max(0, Math.min(10, n));
    }
    f.nota = nota;
    this.alterados.set(f.chave, nota == null ? '' : String(nota));
    this.temAlteracao.set(true);
    this.salvo.set(false);
    this.recalcular(mod);
    this.modulos.set([...this.modulos()]);
  }

  private media(valores: (number | null)[]): number | null {
    const v = valores.filter((n): n is number => n != null);
    if (!v.length) return null;
    return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  }
  private recalcular(mod: ModuloComNotas): void {
    mod.avaliadas = mod.funcoes.filter((f) => f.nota != null).length;
    mod.media = this.media(mod.funcoes.map((f) => f.nota));
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
      await firstValueFrom(
        this.http.post<ApiEnvelope<{ salvo: boolean }>>(
          `${this.base}/${id}/salvar`,
          { notas },
        ),
      );
      this.alterados.clear();
      this.temAlteracao.set(false);
      this.salvo.set(true);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Falha ao salvar. Tente novamente.'));
    } finally {
      this.salvando.set(false);
    }
  }
}
