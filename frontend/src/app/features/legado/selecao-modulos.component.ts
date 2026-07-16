import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { LegadoService } from '../../core/services/legado.service';
import { LegadoClienteEstadoService } from '../../core/services/legado-cliente-estado.service';
import { AcaoLegado, ArquivoBaixavel, GrupoCatalogo, RoleLegado, getAcao, getRole } from '../../core/models/legado.model';
import { baixarArquivoLegado } from './baixar.util';

@Component({
  selector: 'app-legado-selecao-modulos',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './selecao-modulos.component.html',
  styleUrl: './selecao-modulos.component.css',
})
export class SelecaoModulosComponent {
  private readonly service = inject(LegadoService);
  private readonly clienteEstado = inject(LegadoClienteEstadoService);
  private readonly route = inject(ActivatedRoute);

  readonly rid = this.route.snapshot.paramMap.get('rid') ?? '';
  readonly aid = this.route.snapshot.paramMap.get('aid') ?? '';
  readonly role: RoleLegado | undefined = getRole(this.rid);
  readonly acao: AcaoLegado | undefined = getAcao(this.rid, this.aid);

  readonly carregando = signal(true);
  readonly gerando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly grupos = signal<GrupoCatalogo[]>([]);
  readonly resultado = signal<{ ok: boolean; erro?: string; arquivo?: ArquivoBaixavel } | null>(null);
  readonly busca = signal('');

  readonly gruposFiltrados = computed(() => {
    const q = this.busca().toLowerCase().trim();
    if (!q) return this.grupos();
    return this.grupos()
      .map((g) => ({
        area: g.area,
        modulos: g.modulos.filter(
          (m) => m.abrev.toLowerCase().includes(q) || (m.descricao || '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.modulos.length > 0);
  });

  readonly totalFiltrado = computed(() => this.gruposFiltrados().reduce((n, g) => n + g.modulos.length, 0));

  cliente = this.clienteEstado.atual()?.nome ?? '';
  data = '';
  responsaveis = '';
  ramo = '';
  localizacao = '';
  observacoes = '';
  modulosSelecionados = new Set<string>();

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.grupos.set(await this.service.catalogo());
    } catch {
      this.erro.set('Não foi possível carregar o catálogo de módulos.');
    } finally {
      this.carregando.set(false);
    }
  }

  alternar(abrev: string, marcado: boolean): void {
    if (marcado) this.modulosSelecionados.add(abrev);
    else this.modulosSelecionados.delete(abrev);
  }

  async gerar(): Promise<void> {
    if (!this.acao) return;
    this.gerando.set(true);
    this.erro.set(null);
    try {
      const tipo = this.acao.gera === 'checklist' ? 'checklist' : 'levantamento';
      const form = {
        cliente: this.cliente,
        data: this.data,
        responsaveis: this.responsaveis,
        ramo: this.ramo,
        localizacao: this.localizacao,
        observacoes: this.observacoes,
      };
      const r = await this.service.formModulos(tipo, form, [...this.modulosSelecionados]);
      this.resultado.set(r);
    } catch {
      this.erro.set('Não foi possível gerar o documento.');
    } finally {
      this.gerando.set(false);
    }
  }

  async baixar(arquivo: ArquivoBaixavel): Promise<void> {
    await baixarArquivoLegado(this.service, arquivo);
  }
}
