import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BiAbasComponent } from './bi-abas.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';
import { LinhaRnsBi, OpcaoRnsBi, ResultadoRnsBi } from '../../core/models/bi-implantacao.model';
import { opcoesVisiveis } from './bi-filtros.util';
import { mensagemErroBi } from './bi-erro.util';
import { BiFiltrosStore } from './bi-filtros.store';

type Ordenacao = keyof Pick<
  LinhaRnsBi,
  'pedido' | 'dataCriacao' | 'statusRns' | 'sigla' | 'fantasia' | 'tipo' | 'rnsImplantacao'
>;

@Component({
  selector: 'app-bi-rns',
  standalone: true,
  imports: [FormsModule, BiAbasComponent],
  templateUrl: './bi-rns.component.html',
  styleUrls: ['./bi-comum.css', './bi-rns.component.css'],
})
export class BiRnsComponent {
  private readonly service = inject(BiImplantacaoService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoRnsBi | null>(null);

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
  readonly statusSel = this.store.statusRns;
  readonly tecnicosSel = this.store.tecnico;
  readonly siglasSel = this.store.sigla;
  readonly tiposSel = this.store.tipo;
  readonly statusImpSel = this.store.statusImplantacao;
  readonly rnsSel = this.store.rns;
  /** '' = todas · 'sim' · 'nao' */
  readonly validada = this.store.validada;

  readonly ordenarPor = signal<Ordenacao>('dataCriacao');
  readonly ordemDesc = signal(true);

  readonly filtros = computed(() => this.resultado()?.filtros ?? null);

  readonly qtdFiltrosAtivos = computed(
    () =>
      this.gruposSel().length +
      this.statusSel().length +
      this.tecnicosSel().length +
      this.siglasSel().length +
      this.tiposSel().length +
      this.statusImpSel().length +
      this.rnsSel().length +
      (this.validada() ? 1 : 0) +
      (this.busca().trim() ? 1 : 0),
  );

  readonly linhas = computed(() => {
    const todas = this.resultado()?.linhas ?? [];
    const q = this.busca().trim().toLowerCase();
    const filtradas = q
      ? todas.filter(
          (l) =>
            l.visaoGeral.toLowerCase().includes(q) ||
            l.fantasia.toLowerCase().includes(q) ||
            l.grupoEconomico.toLowerCase().includes(q) ||
            l.rns.includes(q) ||
            String(l.rnsImplantacao).includes(q) ||
            l.sigla.toLowerCase().includes(q) ||
            l.tecnico.toLowerCase().includes(q),
        )
      : todas;
    const campo = this.ordenarPor();
    const sinal = this.ordemDesc() ? -1 : 1;
    return [...filtradas].sort((a, b) => {
      const x = a[campo];
      const y = b[campo];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sinal;
      return String(x).localeCompare(String(y), 'pt-BR') * sinal;
    });
  });

  /** Todos os painéis desta tela derivam das linhas visíveis (mesma regra das outras). */
  readonly totaisVisiveis = computed(() => {
    const l = this.linhas();
    return {
      quantidade: l.length,
      validadas: l.filter((x) => x.validadaCliente).length,
      naoValidadas: l.filter((x) => !x.validadaCliente).length,
      implantacoes: new Set(l.map((x) => x.rnsImplantacao)).size,
      clientes: new Set(l.map((x) => x.fantasia).filter(Boolean)).size,
    };
  });

  private contarPor(chave: (l: LinhaRnsBi) => string) {
    const mapa = new Map<string, number>();
    for (const l of this.linhas()) {
      const k = chave(l) || '(sem informação)';
      mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
    return [...mapa.entries()]
      .map(([chave, quantidade]) => ({ chave, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.chave.localeCompare(b.chave));
  }

  readonly porStatusVisivel = computed(() => this.contarPor((l) => l.statusRns));
  readonly porSiglaVisivel = computed(() => this.contarPor((l) => l.sigla));

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.rns({
        dataIni: this.dataIni || undefined,
        dataFim: this.dataFim || undefined,
        grupo: this.gruposSel(),
        status: this.statusSel(),
        tecnico: this.tecnicosSel(),
        sigla: this.siglasSel(),
        tipo: this.tiposSel(),
        statusImplantacao: this.statusImpSel(),
        rns: this.rnsSel(),
        validada: this.validada() || undefined,
      });
      this.resultado.set(r);
      if (r.erro) this.erro.set(r.erro);
      this.dataIni = r.periodo.inicio;
      this.dataFim = r.periodo.fim;
    } catch (e) {
      this.erro.set(mensagemErroBi(e, 'as RNS vinculadas'));
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

  definirValidada(v: string): void {
    this.validada.set(v);
    void this.carregar();
  }

  /** Limpa TODOS os filtros compartilhados — inclusive os que só existem em outra aba,
   * senão um filtro invisível aqui continuaria valendo lá. */
  async limparFiltros(): Promise<void> {
    this.store.limpar();
    await this.carregar();
  }

  termoOpcao(bloco: string): string {
    return this.buscaOpcoes()[bloco] ?? '';
  }

  definirTermoOpcao(bloco: string, valor: string): void {
    this.buscaOpcoes.update((m) => ({ ...m, [bloco]: valor }));
  }

  opcoes(bloco: string, lista: string[], selecao: WritableSignal<string[]>) {
    return opcoesVisiveis(lista, this.termoOpcao(bloco), (v) => v, (v) => selecao().includes(v));
  }

  opcoesRns(bloco: string, lista: OpcaoRnsBi[]) {
    return opcoesVisiveis(
      lista,
      this.termoOpcao(bloco),
      (o) => o.rotulo,
      (o) => this.rnsSel().includes(o.codigo),
    );
  }

  ordenar(campo: Ordenacao): void {
    if (this.ordenarPor() === campo) this.ordemDesc.update((v) => !v);
    else {
      this.ordenarPor.set(campo);
      this.ordemDesc.set(true);
    }
  }

  dataBr(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  /** Cor do status da RNS pelo prefixo numérico (99-Cancelada, 10-Entregue, …). */
  corStatus(status: string): string {
    const n = (status ?? '').split('-')[0].trim();
    if (n === '99') return '#c62828';
    if (n === '10' || n === '8') return '#2e7d32';
    if (n === '9' || n === '6') return '#1565c0';
    if (n === '0') return '#ef6c00';
    return '#78909c';
  }

  exportarCsv(): void {
    const cab = [
      'RNS', 'Data', 'Status', 'Tipo', 'Sigla', 'Sistema', 'Cliente', 'Grupo econômico',
      'Visão geral', 'Versões geração', 'Validada cliente',
      'RNS implantação', 'Status implantação', 'Consultor', 'Responsável',
    ];
    const escapar = (v: string | number | boolean | null): string => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = this.linhas().map((l) =>
      [
        l.rns, l.dataCriacao, l.statusRns, l.tipo, l.sigla, l.sistema, l.fantasia,
        l.grupoEconomico, l.visaoGeral, l.versoesGeracao, l.validadaCliente ? 'Sim' : 'Não',
        l.rnsImplantacao, l.statusImplantacao, l.tecnico, l.responsavel,
      ].map(escapar).join(';'),
    );
    const csv = `﻿${cab.join(';')}\n${linhas.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rns-vinculadas_${this.dataIni}_a_${this.dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
