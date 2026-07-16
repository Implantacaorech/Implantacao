import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LevantamentoService } from '../../core/services/levantamento.service';
import { ProjetosService } from '../../core/services/projetos.service';
import { LevantamentoRespostaLinha, LevantamentoResumo } from '../../core/models/levantamento.model';

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

export interface ItemLevantamentoRender extends LevantamentoRespostaLinha {
  mostrarModulo: boolean;
  mostrarAdicional: boolean;
}

export interface GrupoLevantamentoRender {
  area: string;
  itens: ItemLevantamentoRender[];
  resp: number;
}

@Component({
  selector: 'app-levantamento',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './levantamento.component.html',
  styleUrl: './levantamento.component.css',
})
export class LevantamentoComponent {
  private readonly service = inject(LevantamentoService);
  private readonly projetos = inject(ProjetosService);
  private readonly route = inject(ActivatedRoute);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly salvo = signal(false);
  readonly cliente = signal('');
  readonly linhas = signal<LevantamentoRespostaLinha[]>([]);
  readonly resumo = signal<LevantamentoResumo>({ respondidas: 0, total: 0 });

  readonly progresso = computed(() => {
    const { respondidas, total } = this.resumo();
    return total ? Math.round((respondidas / total) * 100) : 0;
  });

  readonly grupos = computed<GrupoLevantamentoRender[]>(() => {
    const porArea = new Map<string, { g: GrupoLevantamentoRender; modAnterior: string | null; adicAnterior: string | null }>();
    const lista: GrupoLevantamentoRender[] = [];
    for (const r of this.linhas()) {
      const area = areaDoModulo(r.moduloSigla, r.modulo);
      let ctrl = porArea.get(area);
      if (!ctrl) {
        ctrl = { g: { area, itens: [], resp: 0 }, modAnterior: null, adicAnterior: null };
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
      ctrl.g.itens.push({ ...r, mostrarModulo, mostrarAdicional });
      if ((r.resposta || '').trim()) ctrl.g.resp++;
    }
    return lista;
  });

  constructor() {
    void this.carregar();
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
    } catch {
      this.erro.set('Não foi possível carregar o levantamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  onRespostaChange(id: number, valor: string): void {
    this.linhas.set(this.linhas().map((l) => (l.id === id ? { ...l, resposta: valor } : l)));
    this.salvo.set(false);
  }

  async salvar(): Promise<void> {
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const respostas: Record<string, string> = {};
      for (const l of this.linhas()) respostas[String(l.id)] = l.resposta;
      const respondidas = await this.service.salvar(this.projetoId, respostas);
      this.resumo.set({ respondidas, total: this.linhas().length });
      this.salvo.set(true);
    } catch {
      this.erro.set('Não foi possível salvar as respostas.');
    } finally {
      this.salvando.set(false);
    }
  }
}
