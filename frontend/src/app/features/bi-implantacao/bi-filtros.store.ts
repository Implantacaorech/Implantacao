import { Injectable, WritableSignal, computed, signal } from '@angular/core';

/** Filtros do BI de Implantação, COMPARTILHADOS entre as abas.
 *
 * Pedido do usuário em 2026-07-29: o que se filtra numa aba vale nas outras. Sendo
 * `providedIn: 'root'`, o serviço vive enquanto a aplicação viver — trocar de aba destrói e
 * recria o componente, mas não este estado.
 *
 * Sobre os nomes: o SICLA tem DOIS "status" e confundi-los troca o significado da tela.
 *  - `statusImplantacao` é o `TIPOSTATUS` da RNS de implantação ("6-Concluída", "5-Uso
 *    Oficial"). No Resumo e no Extrato ele viaja como `status`; na página RNS, como
 *    `statusImplantacao`.
 *  - `statusRns` é o status da RNS filha ("10-Entregue", "99-Cancelada"), só da página RNS. */
@Injectable({ providedIn: 'root' })
export class BiFiltrosStore {
  // Período — vazio significa "deixa o backend decidir" (últimos 12 meses).
  readonly dataIni = signal('');
  readonly dataFim = signal('');

  /** Mês do calendário de Agendas (AAAA-MM) — aquela tela é mensal, não por período livre. */
  readonly mesAgenda = signal('');

  // Compartilhados por todas as páginas que os tenham.
  readonly grupo = signal<string[]>([]);
  readonly rns = signal<string[]>([]);
  readonly statusImplantacao = signal<string[]>([]);
  readonly tecnico = signal<string[]>([]);
  readonly cliente = signal<string[]>([]);
  readonly sigla = signal<string[]>([]);

  // Específicos de uma ou outra página (também compartilhados, por consistência).
  readonly ativo = signal<string[]>([]);
  readonly tipoCliente = signal<string[]>([]);
  readonly statusRns = signal<string[]>([]);
  readonly tipo = signal<string[]>([]);
  /** '' = todas · 'sim' · 'nao' */
  readonly validada = signal('');

  /** A busca textual é local à página: cada tela procura em campos diferentes. */
  readonly busca = signal('');

  /** Painel de filtros aberto? Começa FECHADO — ele ocupa muito espaço e a tela deve abrir
   * mostrando o resultado, não a configuração. Fica no store para que abrir numa aba não
   * force reabrir na seguinte; recarregar a página volta ao padrão fechado. */
  readonly filtrosAbertos = signal(false);

  alternarFiltros(): void {
    this.filtrosAbertos.update((v) => !v);
  }

  /** Termo digitado dentro de cada bloco de filtro. */
  readonly buscaOpcoes = signal<Record<string, string>>({});

  private get selecoes(): WritableSignal<string[]>[] {
    return [
      this.grupo, this.rns, this.statusImplantacao, this.tecnico, this.cliente,
      this.sigla, this.ativo, this.tipoCliente, this.statusRns, this.tipo,
    ];
  }

  /** Quantos filtros estão marcados — sem contar a busca, que é da página. */
  readonly qtdAtivos = computed(
    () =>
      this.grupo().length +
      this.rns().length +
      this.statusImplantacao().length +
      this.tecnico().length +
      this.cliente().length +
      this.sigla().length +
      this.ativo().length +
      this.tipoCliente().length +
      this.statusRns().length +
      this.tipo().length +
      (this.validada() ? 1 : 0),
  );

  alternar(selecao: WritableSignal<string[]>, valor: string): void {
    selecao.update((v) => (v.includes(valor) ? v.filter((x) => x !== valor) : [...v, valor]));
  }

  marcado(selecao: WritableSignal<string[]>, valor: string): boolean {
    return selecao().includes(valor);
  }

  termoOpcao(bloco: string): string {
    return this.buscaOpcoes()[bloco] ?? '';
  }

  definirTermoOpcao(bloco: string, valor: string): void {
    this.buscaOpcoes.update((m) => ({ ...m, [bloco]: valor }));
  }

  /** Zera os filtros. O PERÍODO é preservado de propósito: é o recorte de trabalho, não um
   * filtro de detalhe — limpar e voltar para "últimos 12 meses" surpreenderia quem está
   * analisando um mês específico. */
  limpar(): void {
    for (const s of this.selecoes) s.set([]);
    this.validada.set('');
    this.busca.set('');
    this.buscaOpcoes.set({});
  }
}
