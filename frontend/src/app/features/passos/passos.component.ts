import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PassosService } from '../../core/services/passos.service';
import { DesignacaoService } from '../../core/services/designacao.service';
import { ProjetosService } from '../../core/services/projetos.service';
import { PermissoesService } from '../../core/services/permissoes.service';
import { DocumentosService } from '../../core/services/documentos.service';
import {
  EmailRegistrado,
  PASSOS_COM_ANEXO_DE_EMAIL,
  Passo,
  Rns,
  TIPOS_RNS,
  TipoRns,
} from '../../core/models/passo.model';
import { Documento } from '../../core/models/documento.model';
import { Projeto } from '../../core/models/projeto.model';

/** Tipo de formulário que um passo abre antes de concluir. */
type FormPasso = 'agendar' | 'designar' | 'registro';

/** Tela dos 21 passos do processo de implantação de um projeto.
 *
 * Mostra o que já foi feito, o que está liberado para QUEM ESTÁ OLHANDO e, quando não está,
 * o motivo em linguagem de negócio — quem é o responsável ou qual passo falta. Quem decide
 * tudo isso é o backend; aqui só se apresenta.
 *
 * Também é a tela de CONSULTA do processo: cada passo mostra os e-mails que o Painel gerou e
 * os documentos produzidos ali, e ambos ficam abertos a quem só tem consulta — inclusive o
 * download do documento. Ver quem fez o quê não é privilégio de quem pode alterar. */
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
  private readonly perm = inject(PermissoesService);
  private readonly docs = inject(DocumentosService);
  private readonly route = inject(ActivatedRoute);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  /** Só CONSULTA quando o painel de Permissões não libera Alteração na Carteira (ex.: o
   * Comercial). Vê o andamento, mas nenhum botão de ação aparece. O backend também barra
   * (403); isto é só a UX. */
  readonly soConsulta = computed(() => !this.perm.podeAlterar('carteira'));

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

  // --- Formulário genérico de registro (descrição, assinatura, e-mail) ---
  descricao = '';
  marcado = false;
  dataMarcada = '';
  emailPara = '';
  emailAssunto = '';
  emailCorpo = '';
  /** Nome do arquivo que o backend anexará ao e-mail deste passo, se houver. */
  readonly emailAnexo = signal('');
  /** `true` enquanto a prévia do e-mail está sendo buscada. */
  readonly carregandoEmail = signal(false);

  // --- Consulta: o que cada passo produziu ---
  readonly emailsGerados = signal<EmailRegistrado[]>([]);
  readonly documentos = signal<Documento[]>([]);
  /** Passos com o painel de registros aberto. */
  readonly registrosAbertos = signal<number[]>([]);
  /** E-mails com o corpo expandido. */
  readonly emailsAbertos = signal<number[]>([]);

  /** Documentos que pertencem a um passo.
   *
   * O vínculo é pelo TIPO do documento — é assim que o backend liga a geração ao passo
   * (`DocumentosService.PASSO_POR_TIPO`). Os anexos de e-mail do Outlook usam o tipo
   * `email_passo_N`, que carrega o número no próprio nome. */
  private static readonly TIPO_DOC_POR_PASSO: Record<number, string> = {
    3: 'levantamento',
    10: 'projeto',
    13: 'cronograma',
    14: 'checklist',
    18: 'termo',
  };

  documentosDoPasso(p: Passo): Documento[] {
    const tipo = PassosComponent.TIPO_DOC_POR_PASSO[p.numero];
    const tipoAnexo = `email_passo_${p.numero}`;
    return this.documentos().filter(
      (d) => d.tipo === tipo || d.tipo === tipoAnexo,
    );
  }

  emailsDoPasso(p: Passo): EmailRegistrado[] {
    return this.emailsGerados().filter((e) => e.passo === p.numero);
  }

  /** Quantos registros o passo tem — o que o cabeçalho do painel de consulta anuncia. */
  totalRegistros(p: Passo): number {
    return this.emailsDoPasso(p).length + this.documentosDoPasso(p).length;
  }

  alternarRegistros(p: Passo): void {
    this.registrosAbertos.update((atual) =>
      atual.includes(p.numero)
        ? atual.filter((n) => n !== p.numero)
        : [...atual, p.numero],
    );
  }

  alternarCorpo(id: number): void {
    this.emailsAbertos.update((atual) =>
      atual.includes(id) ? atual.filter((n) => n !== id) : [...atual, id],
    );
  }

  rotuloStatus(e: EmailRegistrado): string {
    if (e.status === 'enviado') return 'enviado';
    return e.status === 'sem_destinatario'
      ? 'sem destinatário'
      : 'falhou no envio';
  }

  /** Baixa o documento do passo. Liberado a quem só tem consulta — foi o que o processo
   * pediu: ver o documento gerado e poder levá-lo, mesmo sem poder alterar nada. */
  async baixarDocumento(doc: Documento): Promise<void> {
    this.erro.set(null);
    try {
      const { blob, filename } = await this.docs.baixar(doc.id, doc.arquivo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.erro.set(this.mensagem(e));
    }
  }

  /** Passos que abrem um formulário PRÓPRIO em vez de só concluir — os que gravam dados em
   * outra estrutura (agenda do levantamento, designação da equipe). */
  private static readonly FORM_POR_PASSO: Record<number, FormPasso> = {
    2: 'agendar',
    8: 'designar',
  };

  /** Que formulário o passo abre antes de concluir.
   *
   * Além dos dois formulários próprios, qualquer passo que exija uma marcação de assinatura
   * (7 e 12) ou que mande a pessoa redigir o e-mail cai no formulário genérico de
   * 'registro'. Passo que não pede nada disso continua sendo um botão "Concluir" direto —
   * abrir um formulário vazio só para clicar "salvar" seria atrito à toa. */
  formDoPasso(p: Passo): FormPasso | null {
    const proprio = PassosComponent.FORM_POR_PASSO[p.numero];
    if (proprio) return proprio;
    return p.rotuloMarcacao || p.redigeEmail ? 'registro' : null;
  }

  /** O que o botão do passo promete. Dizer "Preencher" num passo cuja ação é mandar um
   * e-mail ao cliente esconde o que vai acontecer ao clicar. */
  rotuloAcao(p: Passo): string {
    if (p.redigeEmail) return 'Redigir e-mail';
    if (p.rotuloMarcacao) return 'Registrar';
    return 'Preencher';
  }

  /** Passos cuja ação é GERAR um documento em outra tela. O fluxo leva a pessoa até lá em
   * vez de ter uma barra de botões espalhada na ficha — o documento gerado conclui o passo
   * sozinho (o backend liga a geração ao passo). É o que mantém o fluxo contínuo e num
   * ponto só: você sempre parte do passo. */
  private static readonly TELA_POR_PASSO: Record<number, string[]> = {
    // Quem pode ABRIR cada uma vem do backend em `p.podeAbrir` — é a permissão da TELA, não
    // a de concluir o passo (ver PERFIS_TELA_DO_PASSO no backend).
    // 3 (levantamento) e 14 (check-list) abrem a tela para PREENCHER. 10 gera o Projeto.
    // 11 é a Conferência: o Administrativo abre o Projeto no layout da Rech para revisar e
    // baixar antes de mandar ao cliente. 13 "Elaborar o cronograma e incluir as agendas no
    // SICLA" abre a AGENDA de Visitas (calendário com a distribuição pelos turnos LIVRES do
    // técnico no SICLA). Todos mostram "Abrir" E "Concluir".
    3: ['levantamento'],
    10: ['projeto', 'origem'],
    11: ['projeto', 'origem'],
    13: ['agenda'],
    14: ['checklist'],
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
      if (tipo === 'registro') {
        this.descricao = '';
        this.marcado = false;
        this.dataMarcada = new Date().toISOString().slice(0, 10);
        this.emailPara = '';
        this.emailAssunto = '';
        this.emailCorpo = '';
        this.emailAnexo.set('');
        if (p.redigeEmail) {
          // O e-mail chega PRONTO do backend (modelo do passo + tokens do projeto já
          // aplicados) e a pessoa revisa. Escrever do zero toda vez seria retrabalho, e um
          // campo vazio convidaria a improvisar o texto institucional.
          this.carregandoEmail.set(true);
          try {
            const previa = await this.service.previaEmail(
              this.projetoId,
              p.numero,
            );
            if (previa) {
              this.emailPara = previa.para.join(', ');
              this.emailAssunto = previa.assunto;
              this.emailCorpo = previa.corpo;
              this.emailAnexo.set(previa.anexo);
            }
          } finally {
            this.carregandoEmail.set(false);
          }
        }
        return;
      }
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

  /** Conclui um passo pelo formulário genérico: descrição, assinatura e/ou e-mail revisado.
   *
   * Só manda o que o passo realmente pede — um `email` num passo que não redige seria
   * recusado pelo backend, e mandar `marcado` onde não há marcação polui o registro. */
  async salvarRegistro(p: Passo): Promise<void> {
    if (p.rotuloMarcacao && !this.marcado) {
      this.erro.set(`Marque "${p.rotuloMarcacao}" para concluir.`);
      return;
    }
    if (p.rotuloMarcacao && !this.dataMarcada) {
      this.erro.set('Informe a data da assinatura.');
      return;
    }
    const dados: Parameters<PassosService['concluir']>[2] = {
      observacao: this.descricao.trim(),
    };
    if (p.rotuloMarcacao) {
      dados.marcado = this.marcado;
      dados.dataMarcada = this.dataMarcada;
    }
    if (p.redigeEmail) {
      dados.email = {
        para: this.emailPara
          .split(/[,;]+/)
          .map((e) => e.trim())
          .filter(Boolean),
        assunto: this.emailAssunto.trim(),
        corpo: this.emailCorpo,
      };
    }
    this.ocupado.set(p.numero);
    this.erro.set(null);
    try {
      this.passos.set(
        await this.service.concluir(this.projetoId, p.numero, dados),
      );
      this.formAberto.set(null);
      // O e-mail sai em segundo plano no backend; recarregar a consulta aqui mostraria uma
      // lista possivelmente sem ele. Quem quiser conferir abre o painel de registros, que
      // busca na hora.
      await this.recarregarRegistros();
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
    }
  }

  /** Passo 8: grava o GCI e os técnicos. O backend conclui o passo sozinho. */
  async salvarDesignacao(): Promise<void> {
    if (!this.gciSelecionado) {
      this.erro.set('Selecione o GCI.');
      return;
    }
    if (this.consultoresSelecionados.length === 0) {
      this.erro.set('Selecione ao menos um técnico.');
      return;
    }
    // Número do passo da designação — 8 desde a revisão de 2026-07-30. Ficava em 6 (a
    // numeração de duas revisões atrás), então o botão certo nunca era desabilitado.
    this.ocupado.set(8);
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
      await this.recarregarRegistros();
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.carregando.set(false);
    }
  }

  /** E-mails gerados e documentos do projeto — a camada de CONSULTA da tela.
   *
   * Falha aqui não derruba o fluxo: os passos já estão na tela e continuam operáveis. O
   * histórico é informativo, e trocar a tela inteira por uma mensagem de erro porque a
   * consulta não veio seria desproporcional. */
  private async recarregarRegistros(): Promise<void> {
    try {
      const [emails, documentos] = await Promise.all([
        this.service.emailsGerados(this.projetoId),
        this.docs.listar(this.projetoId),
      ]);
      this.emailsGerados.set(emails);
      this.documentos.set(documentos);
    } catch {
      // Silencioso de propósito — ver o comentário acima.
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

  /** Passos 11 e 19: concluído mas ainda sem a conferência que libera o seguinte. */
  aguardandoConferencia(p: Passo): boolean {
    return p.concluido && !p.conferido && this.temConferencia(p);
  }

  temConferencia(p: Passo): boolean {
    return p.numero === 11 || p.numero === 19;
  }

  /** Passos 4 e 6: o e-mail sai do Outlook da pessoa; o Painel guarda a PROVA. */
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
