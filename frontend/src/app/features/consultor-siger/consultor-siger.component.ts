import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConsultorSigerService } from '../../core/services/consultor-siger.service';
import {
  ConfiancaConsulta,
  ItemSecao,
  RespostaConsultorSiger,
  VisaoConsulta,
} from '../../core/models/consultor-siger.model';

/** Ordem e título das seções — prioridade de leitura na implantação (a resposta do
 * backend só traz as seções com evidência; aqui só se dá nome e ordem a elas). */
const SECOES: Array<[string, string]> = [
  ['resumo', 'Resumo'],
  ['comoFunciona', 'Como funciona'],
  ['regrasValidacoes', 'Regras, validações e possíveis bloqueios'],
  ['configuracoes', 'Configurações'],
  ['cadastros', 'Cadastros e tabelas envolvidas'],
  ['telasMenus', 'Telas e menus'],
  ['alteracoesRecentes', 'Alterações recentes (versão atual)'],
  ['origemTecnica', 'Origem técnica'],
];

const ROTULO_CONFIANCA: Record<ConfiancaConsulta, string> = {
  alta: '🟢 Alta confiança',
  media: '🟡 Média confiança',
  baixa: '🟠 Baixa confiança',
  nao_confirmado: '⚪ Não confirmado',
};

const EXEMPLOS = [
  'Como funciona o faturamento de pedidos?',
  'O que preciso configurar para emitir NF?',
  'Quais cadastros são necessários para compras?',
  'Por que o sistema bloqueia o pedido?',
  'Quais parâmetros controlam o faturamento?',
];

/** Histórico e favoritos ficam no navegador (localStorage) nesta primeira entrega — a
 * decisão de persistir no banco do Painel está em docs/pendencias.md. */
const CHAVE_HISTORICO = 'consultor_siger.historico';
const CHAVE_FAVORITOS = 'consultor_siger.favoritos';

function lerLista(chave: string): string[] {
  try {
    return (JSON.parse(localStorage.getItem(chave) ?? '[]') as string[]).filter(
      (v) => typeof v === 'string',
    );
  } catch {
    return [];
  }
}

function gravarLista(chave: string, lista: string[]): void {
  localStorage.setItem(chave, JSON.stringify(lista.slice(0, 30)));
}

/** Tela **Execução → Consultor SIGER** — o consultor pergunta em linguagem natural e
 * recebe resposta estruturada e rastreável vinda da base derivada do código-fonte
 * (cada item cita arquivo:linha; sem evidência a tela diz "não confirmado"). */
@Component({
  selector: 'app-consultor-siger',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './consultor-siger.component.html',
  styleUrl: './consultor-siger.component.css',
})
export class ConsultorSigerComponent {
  private readonly servico = inject(ConsultorSigerService);

  readonly exemplos = EXEMPLOS;
  readonly pergunta = signal('');
  readonly visao = signal<VisaoConsulta>('funcional');
  readonly carregando = signal(false);
  readonly resposta = signal<RespostaConsultorSiger | null>(null);
  readonly erro = signal('');
  readonly historico = signal<string[]>(lerLista(CHAVE_HISTORICO));
  readonly favoritos = signal<string[]>(lerLista(CHAVE_FAVORITOS));
  readonly fontesAbertas = signal(false);
  readonly feedbackEnviado = signal(false);

  async pesquisar(texto?: string): Promise<void> {
    const q = (texto ?? this.pergunta()).trim();
    if (q.length < 2 || this.carregando()) return;
    this.pergunta.set(q);
    this.carregando.set(true);
    this.erro.set('');
    this.fontesAbertas.set(false);
    this.feedbackEnviado.set(false);
    try {
      this.resposta.set(await this.servico.pesquisar(q, this.visao()));
      const hist = [q, ...this.historico().filter((h) => h !== q)];
      this.historico.set(hist.slice(0, 30));
      gravarLista(CHAVE_HISTORICO, hist);
    } catch {
      this.erro.set('Não foi possível consultar o backend — tente novamente.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Trocar a visão com uma resposta na tela refaz a pesquisa (a seção técnica vem do backend). */
  async trocarVisao(v: VisaoConsulta): Promise<void> {
    this.visao.set(v);
    if (this.resposta()) await this.pesquisar(this.resposta()!.pergunta);
  }

  secoesOrdenadas(r: RespostaConsultorSiger): Array<{ titulo: string; itens: ItemSecao[] }> {
    return SECOES.filter(([chave]) => r.secoes[chave]?.length).map(([chave, titulo]) => ({
      titulo,
      itens: r.secoes[chave],
    }));
  }

  rotuloConfianca(c: ConfiancaConsulta): string {
    return ROTULO_CONFIANCA[c] ?? c;
  }

  ehFavorita(q: string): boolean {
    return this.favoritos().includes(q);
  }

  alternarFavorito(): void {
    const q = this.resposta()?.pergunta ?? this.pergunta();
    if (!q) return;
    const lista = this.ehFavorita(q)
      ? this.favoritos().filter((f) => f !== q)
      : [q, ...this.favoritos()];
    this.favoritos.set(lista.slice(0, 30));
    gravarLista(CHAVE_FAVORITOS, lista);
  }

  async avaliar(util: boolean): Promise<void> {
    const r = this.resposta();
    if (!r || this.feedbackEnviado()) return;
    let observacao: string | undefined;
    if (!util) {
      observacao = window.prompt('O que estava incorreto ou faltando?') ?? undefined;
    }
    try {
      await this.servico.enviarFeedback(r.pergunta, util, observacao);
      this.feedbackEnviado.set(true);
    } catch {
      this.erro.set('Não foi possível registrar o feedback agora.');
    }
  }

  /** Só o nome do arquivo — o caminho completo fica no title (tooltip) da evidência. */
  nomeArquivo(caminho: string): string {
    return caminho.split(/[\\/]/).pop() ?? caminho;
  }
}
