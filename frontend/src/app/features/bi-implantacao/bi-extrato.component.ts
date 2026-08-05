import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BiAbasComponent } from './bi-abas.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';
import {
  LinhaExtratoBi,
  OpcaoRnsBi,
  ResultadoExtratoBi,
} from '../../core/models/bi-implantacao.model';
import { opcoesVisiveis } from './bi-filtros.util';
import { mensagemErroBi } from './bi-erro.util';
import { BiFiltrosStore } from './bi-filtros.store';

/** Quantos caracteres da descrição aparecem na linha antes do "ver mais" — é o mesmo corte
 * que a medida `Tabela_Resumo_HTML` do Power BI fazia (60 caracteres). */
const CORTE_PREVIA = 60;

@Component({
  selector: 'app-bi-extrato',
  standalone: true,
  imports: [FormsModule, BiAbasComponent],
  templateUrl: './bi-extrato.component.html',
  styleUrls: ['./bi-comum.css', './bi-extrato.component.css'],
})
export class BiExtratoComponent {
  private readonly service = inject(BiImplantacaoService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoExtratoBi | null>(null);

  // Filtros vindos do STORE compartilhado: o que se marca aqui vale nas outras abas.
  private readonly store = inject(BiFiltrosStore);
  readonly filtrosAbertos = this.store.filtrosAbertos;
  readonly buscaOpcoes = this.store.buscaOpcoes;
  readonly busca = this.store.busca;

  /** Período via store, mas exposto como propriedade para o `[(ngModel)]` dos inputs. */
  get dataIni(): string { return this.store.dataIni(); }
  set dataIni(v: string) { this.store.dataIni.set(v); }
  get dataFim(): string { return this.store.dataFim(); }
  set dataFim(v: string) { this.store.dataFim.set(v); }

  readonly gruposSel = this.store.grupo;
  readonly tecnicosSel = this.store.tecnico;
  readonly siglasSel = this.store.sigla;
  readonly clientesSel = this.store.cliente;
  readonly statusSel = this.store.statusImplantacao;
  readonly rnsSel = this.store.rns;

  /** Item aberto no painel de descrição (chave `protocolo|data hora`). */
  readonly abertoId = signal<string | null>(null);
  readonly textoAberto = signal<string>('');
  readonly carregandoTexto = signal(false);

  readonly filtros = computed(() => this.resultado()?.filtros ?? null);
  readonly truncado = computed(() => this.resultado()?.truncado ?? false);

  readonly qtdFiltrosAtivos = computed(
    () =>
      this.gruposSel().length +
      this.tecnicosSel().length +
      this.siglasSel().length +
      this.clientesSel().length +
      this.statusSel().length +
      this.rnsSel().length +
      (this.busca().trim() ? 1 : 0),
  );

  /** Busca local sobre o que já veio do período (assunto, descrição, cliente, técnico…). */
  readonly linhas = computed(() => {
    const todas = this.resultado()?.linhas ?? [];
    const q = this.busca().trim().toLowerCase();
    if (!q) return todas;
    return todas.filter(
      (l) =>
        l.assunto.toLowerCase().includes(q) ||
        l.descricao.toLowerCase().includes(q) ||
        l.fantasia.toLowerCase().includes(q) ||
        l.grupoEconomico.toLowerCase().includes(q) ||
        l.tecnico.toLowerCase().includes(q) ||
        l.sigla.toLowerCase().includes(q) ||
        String(l.protocolo ?? '').includes(q) ||
        String(l.rns).includes(q),
    );
  });

  /** Totais das linhas VISÍVEIS — como no Resumo, todo painel segue todos os filtros. */
  readonly totaisVisiveis = computed(() => {
    const l = this.linhas();
    return {
      lancamentos: l.length,
      horasUtilizadas:
        Math.round(l.reduce((a, x) => a + x.horasUtilizadas, 0) * 100) / 100,
      saldoAtual: l.length > 0 ? l[0].saldoAcumulado : null,
      consultores: new Set(l.map((x) => x.tecnico).filter(Boolean)).size,
      clientes: new Set(l.map((x) => x.fantasia).filter(Boolean)).size,
    };
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.abertoId.set(null);
    try {
      const r = await this.service.extrato({
        dataIni: this.dataIni || undefined,
        dataFim: this.dataFim || undefined,
        grupo: this.gruposSel(),
        tecnico: this.tecnicosSel(),
        sigla: this.siglasSel(),
        cliente: this.clientesSel(),
        status: this.statusSel(),
        rns: this.rnsSel(),
      });
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
      this.dataIni = r.periodo.inicio;
      this.dataFim = r.periodo.fim;
    } catch (e) {
      this.erro.set(mensagemErroBi(e, 'o Extrato de Protocolo/Horas'));
    } finally {
      this.carregando.set(false);
    }
  }

  alternarFiltros(): void {
    this.store.alternarFiltros();
  }

  alternar(selecao: WritableSignal<string[]>, valor: string): void {
    selecao.update((v) => (v.includes(valor) ? v.filter((x) => x !== valor) : [...v, valor]));
    void this.carregar();
  }

  marcado(selecao: WritableSignal<string[]>, valor: string): boolean {
    return selecao().includes(valor);
  }

  /** Limpa TODOS os filtros compartilhados — inclusive os que só existem em outra aba,
   * senão um filtro invisível aqui continuaria valendo lá. */
  async limparFiltros(): Promise<void> {
    this.store.limpar();
    await this.carregar();
  }

  // ── Busca dentro dos blocos de filtro (listas com centenas de opções) ─────────────
  termoOpcao(bloco: string): string {
    return this.buscaOpcoes()[bloco] ?? '';
  }

  definirTermoOpcao(bloco: string, valor: string): void {
    this.buscaOpcoes.update((m) => ({ ...m, [bloco]: valor }));
  }

  opcoes(bloco: string, lista: string[], selecao: WritableSignal<string[]>) {
    return opcoesVisiveis(
      lista,
      this.termoOpcao(bloco),
      (v) => v,
      (v) => selecao().includes(v),
    );
  }

  opcoesRns(bloco: string, lista: OpcaoRnsBi[]) {
    return opcoesVisiveis(
      lista,
      this.termoOpcao(bloco),
      (o) => o.rotulo,
      (o) => this.rnsSel().includes(o.codigo),
    );
  }

  chaveDe(l: LinhaExtratoBi): string {
    return `${l.protocolo ?? 0}|${l.data} ${l.hora}`;
  }

  /** Prévia curta, sem quebras de linha — o corte do relatório original. */
  previa(l: LinhaExtratoBi): string {
    const limpo = l.descricao.replace(/[\r\n]+/g, ' ').trim();
    return limpo.length > CORTE_PREVIA ? `${limpo.slice(0, CORTE_PREVIA)}…` : limpo;
  }

  temMaisTexto(l: LinhaExtratoBi): boolean {
    return l.descricaoTruncada || l.descricao.replace(/[\r\n]+/g, ' ').trim().length > CORTE_PREVIA;
  }

  /** Abre/fecha a descrição. Só vai ao banco quando o texto está truncado — caso contrário
   * o que veio na listagem já é o texto inteiro. */
  async alternarDescricao(l: LinhaExtratoBi): Promise<void> {
    const chave = this.chaveDe(l);
    if (this.abertoId() === chave) {
      this.abertoId.set(null);
      return;
    }
    this.abertoId.set(chave);
    if (!l.descricaoTruncada || !l.protocolo) {
      this.textoAberto.set(l.descricao);
      return;
    }
    this.carregandoTexto.set(true);
    this.textoAberto.set('');
    try {
      const r = await this.service.descricao(l.protocolo, `${l.data} ${l.hora}`);
      this.textoAberto.set(r.erro ? `${l.descricao}\n\n(não foi possível carregar o restante: ${r.erro})` : r.descricao);
    } catch {
      this.textoAberto.set(`${l.descricao}\n\n(não foi possível carregar o restante)`);
    } finally {
      this.carregandoTexto.set(false);
    }
  }

  horas(v: number): string {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  dataBr(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  exportarCsv(): void {
    const cab = [
      'Data', 'Hora', 'RNS', 'Cliente', 'Grupo econômico', 'Sigla', 'Sistema',
      'Consultor', 'Assunto', 'Protocolo', 'Horas', 'Saldo acumulado',
    ];
    const escapar = (v: string | number | null): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = this.linhas().map((l) =>
      [
        l.data, l.hora, l.rns, l.fantasia, l.grupoEconomico, l.sigla, l.sistema,
        l.tecnico, l.assunto, l.protocolo, l.horasUtilizadas, l.saldoAcumulado,
      ].map(escapar).join(';'),
    );
    // `\uFEFF` (BOM) na frente do CSV: é o que faz o Excel abrir o arquivo
    // como UTF-8 em vez de ANSI (sem ele, acento sai trocado na planilha).
    const csv = `\uFEFF${cab.join(';')}\n${linhas.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-horas_${this.dataIni}_a_${this.dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
