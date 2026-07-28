import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PassosService } from '../../core/services/passos.service';
import { DesignacaoService } from '../../core/services/designacao.service';
import { ProjetosService } from '../../core/services/projetos.service';
import {
  PASSOS_COM_ANEXO_DE_EMAIL,
  Passo,
  Rns,
  TIPOS_RNS,
  TipoRns,
} from '../../core/models/passo.model';
import { Projeto } from '../../core/models/projeto.model';

/** Tela dos 18 passos do processo de implantação de um projeto.
 *
 * Mostra o que já foi feito, o que está liberado para QUEM ESTÁ OLHANDO e, quando não está,
 * o motivo em linguagem de negócio — quem é o responsável ou qual passo falta. Quem decide
 * tudo isso é o backend; aqui só se apresenta. */
@Component({
  selector: 'app-passos',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './passos.component.html',
  styleUrl: './passos.component.css',
})
export class PassosComponent {
  private readonly service = inject(PassosService);
  private readonly projetos = inject(ProjetosService);
  private readonly designacao = inject(DesignacaoService);
  private readonly route = inject(ActivatedRoute);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly cliente = signal('');
  /** Projeto completo — alimenta o painel de dados do cliente no topo do fluxo. */
  readonly projeto = signal<Projeto | null>(null);
  /** Painel de dados recolhido por padrão: o foco da tela é o fluxo, não o cadastro. */
  readonly dadosAbertos = signal(false);
  readonly passos = signal<Passo[]>([]);
  readonly rns = signal<Rns[]>([]);
  readonly ocupado = signal<number | null>(null);
  /** Passos cujo e-mail foi anexado nesta sessão — feedback imediato na tela. */
  readonly anexados = signal<number[]>([]);

  readonly tiposRns = TIPOS_RNS;

  /** Passo aberto para preencher os dados que ele exige. O passo não é uma caixinha: o
   * agendamento pede data e levantadores, a designação pede GCI e técnicos. Sem isso, a
   * pessoa teria de sair da tela, achar a tela certa e voltar. */
  readonly formAberto = signal<number | null>(null);
  readonly consultoresDisponiveis = signal<string[]>([]);
  /** Levantadores vêm do PAPEL 'Levantador' no cadastro — na prática são os GCIs, mas
   * quem define é a marcação do usuário, não o perfil de consultor. */
  readonly levantadoresDisponiveis = signal<string[]>([]);
  readonly gcisDisponiveis = signal<string[]>([]);
  dataLevantamento = '';
  levantadoresSelecionados: string[] = [];
  gciSelecionado = '';
  consultoresSelecionados: string[] = [];

  /** Passos que abrem formulário em vez de só concluir. */
  private static readonly FORM_POR_PASSO: Record<number, 'agendar' | 'designar'> = {
    2: 'agendar',
    7: 'designar',
  };

  formDoPasso(p: Passo): 'agendar' | 'designar' | null {
    return PassosComponent.FORM_POR_PASSO[p.numero] ?? null;
  }

  /** Passos cuja ação é GERAR um documento em outra tela. O fluxo leva a pessoa até lá em
   * vez de ter uma barra de botões espalhada na ficha — o documento gerado conclui o passo
   * sozinho (o backend liga a geração ao passo). É o que mantém o fluxo contínuo e num
   * ponto só: você sempre parte do passo. */
  private static readonly TELA_POR_PASSO: Record<number, string[]> = {
    // 3 (levantamento) e 12 (check-list) abrem a tela para PREENCHER. 9 gera o Projeto. 11
    // "Elaborar o cronograma e incluir as agendas no SICLA" abre a AGENDA de Visitas
    // (calendário com a distribuição pelos turnos LIVRES do técnico no SICLA — a "janela de
    // criação de cronograma"). Todos mostram "Abrir" E "Concluir".
    3: ['levantamento'],
    9: ['projeto', 'origem'],
    11: ['agenda'],
    12: ['checklist'],
  };

  /** Rota da tela que o passo abre, ou `null` se o passo se resolve aqui mesmo. */
  telaDoPasso(p: Passo): string[] | null {
    const destino = PassosComponent.TELA_POR_PASSO[p.numero];
    return destino ? ['/projetos', String(this.projetoId), ...destino] : null;
  }

  async abrirForm(p: Passo): Promise<void> {
    this.erro.set(null);
    const tipo = this.formDoPasso(p);
    if (!tipo) return;
    this.formAberto.set(p.numero);
    try {
      if (tipo === 'agendar') {
        const [view, pessoas] = await Promise.all([
          this.designacao.obterAgendar(this.projetoId),
          this.service.pessoas(this.projetoId),
        ]);
        this.dataLevantamento = view.dataLevantamento || '';
        this.levantadoresSelecionados = pessoas.levantadores.map((l) => l.pessoa);
        this.levantadoresDisponiveis.set(
          await this.service.pessoasPorPapel('Levantador'),
        );
      } else {
        const [gciView, cons, pessoas] = await Promise.all([
          this.designacao.obterDefinirGci(this.projetoId),
          this.designacao.obterConsultores(this.projetoId),
          this.service.pessoas(this.projetoId),
        ]);
        this.gcisDisponiveis.set(gciView.gcis);
        this.gciSelecionado = (gciView.gciAtual || '').split(',')[0].trim();
        this.consultoresDisponiveis.set(cons.consultores);
        this.consultoresSelecionados = pessoas.consultores.map((c) => c.pessoa);
      }
    } catch (e) {
      this.erro.set(this.mensagem(e));
      this.formAberto.set(null);
    }
  }

  fecharForm(): void {
    this.formAberto.set(null);
  }

  alternarSelecao(lista: string[], nome: string, marcado: boolean): string[] {
    return marcado
      ? [...new Set([...lista, nome])]
      : lista.filter((n) => n !== nome);
  }

  /** Passo 2: grava data + levantadores. O backend conclui o passo sozinho. */
  async salvarAgendamento(): Promise<void> {
    if (!this.dataLevantamento) {
      this.erro.set('Informe a data do levantamento.');
      return;
    }
    this.ocupado.set(2);
    this.erro.set(null);
    try {
      await this.designacao.agendar(
        this.projetoId,
        this.dataLevantamento,
        this.levantadoresSelecionados,
      );
      this.formAberto.set(null);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
    }
  }

  /** Passo 7: grava o GCI e os técnicos. O backend conclui o passo sozinho. */
  async salvarDesignacao(): Promise<void> {
    if (!this.gciSelecionado) {
      this.erro.set('Selecione o GCI.');
      return;
    }
    if (this.consultoresSelecionados.length === 0) {
      this.erro.set('Selecione ao menos um técnico.');
      return;
    }
    this.ocupado.set(6);
    this.erro.set(null);
    try {
      await this.designacao.definirGci(this.projetoId, [this.gciSelecionado]);
      await this.service.definirPessoas(
        this.projetoId,
        'consultor',
        this.consultoresSelecionados,
      );
      this.formAberto.set(null);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
    }
  }
  novoTipo: TipoRns = 'RNI';
  novoNumero = '';
  novaDescricao = '';

  readonly concluidos = computed(
    () => this.passos().filter((p) => p.concluido).length,
  );

  readonly progresso = computed(() => {
    const total = this.passos().length;
    return total === 0 ? 0 : Math.round((this.concluidos() / total) * 100);
  });

  /** Passos agrupados por macro-etapa, preservando a ordem do processo. */
  readonly porEtapa = computed(() => {
    const grupos = new Map<string, Passo[]>();
    for (const p of this.passos()) {
      const lista = grupos.get(p.etapa);
      if (lista) lista.push(p);
      else grupos.set(p.etapa, [p]);
    }
    return [...grupos.entries()].map(([etapa, itens]) => ({ etapa, itens }));
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [passos, projeto, rns] = await Promise.all([
        this.service.listar(this.projetoId),
        this.projetos.buscar(this.projetoId),
        this.service.listarRns(this.projetoId),
      ]);
      this.passos.set(passos);
      this.projeto.set(projeto);
      this.cliente.set(projeto.cliente);
      this.rns.set(rns);
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.carregando.set(false);
    }
  }

  private mensagem(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const corpo = e.error as { message?: string } | undefined;
      return corpo?.message ?? `Falha na comunicação (HTTP ${e.status}).`;
    }
    return 'Falha inesperada.';
  }

  private async executar(
    numero: number,
    acao: () => Promise<Passo[]>,
  ): Promise<void> {
    this.ocupado.set(numero);
    this.erro.set(null);
    try {
      this.passos.set(await acao());
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
    }
  }

  concluir(p: Passo): Promise<void> {
    return this.executar(p.numero, () =>
      this.service.concluir(this.projetoId, p.numero),
    );
  }

  conferir(p: Passo): Promise<void> {
    return this.executar(p.numero, () =>
      this.service.conferir(this.projetoId, p.numero),
    );
  }

  reabrir(p: Passo): Promise<void> {
    return this.executar(p.numero, () =>
      this.service.reabrir(this.projetoId, p.numero),
    );
  }

  /** Passo 10 e 17: concluído mas ainda sem a conferência que libera o seguinte. */
  aguardandoConferencia(p: Passo): boolean {
    return p.concluido && !p.conferido && this.temConferencia(p);
  }

  temConferencia(p: Passo): boolean {
    return p.numero === 10 || p.numero === 17;
  }

  /** Passos 4 e 5: o e-mail sai do Outlook da pessoa; o Painel guarda a PROVA. */
  aceitaAnexoDeEmail(p: Passo): boolean {
    return PASSOS_COM_ANEXO_DE_EMAIL.includes(p.numero);
  }

  async anexarEmail(p: Passo, evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    this.ocupado.set(p.numero);
    this.erro.set(null);
    try {
      await this.service.anexarEmail(this.projetoId, p.numero, arquivo);
      this.anexados.update((atual) => [...atual, p.numero]);
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
      input.value = '';
    }
  }

  async acrescentarRns(): Promise<void> {
    this.erro.set(null);
    try {
      await this.service.criarRns(this.projetoId, {
        tipo: this.novoTipo,
        numero: this.novoNumero,
        descricao: this.novaDescricao,
      });
      this.rns.set(await this.service.listarRns(this.projetoId));
      this.novoNumero = '';
      this.novaDescricao = '';
    } catch (e) {
      this.erro.set(this.mensagem(e));
    }
  }

  async removerRns(id: number): Promise<void> {
    this.erro.set(null);
    try {
      await this.service.removerRns(this.projetoId, id);
      this.rns.set(await this.service.listarRns(this.projetoId));
    } catch (e) {
      this.erro.set(this.mensagem(e));
    }
  }
}
