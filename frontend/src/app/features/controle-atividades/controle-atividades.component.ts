import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ControleAtividadesService } from '../../core/services/controle-atividades.service';
import {
  AchadoBusca,
  CartaoAtividade,
  ColunaQuadro,
  ConsultorPainel,
  ContatoCliente,
  Etiqueta,
  ListaDeQuadros,
  PreviaTrello,
  ProjetoDisponivel,
  QuadroCompleto,
  QuadroResumo,
  ResultadoImportacao,
} from '../../core/models/controle-atividades.model';

/** Execução → Controle de Atividades — quadro de atividades por cliente.
 *
 * O que a tela habilita vem do backend (`podeEditar`/`podeInteragir`/`podeCriarCartao`), e
 * não de uma regra reimplementada aqui: a autorização de verdade é sempre revalidada a cada
 * rota, e duplicar a regra no navegador só criaria uma segunda versão dela para divergir. */
@Component({
  selector: 'app-controle-atividades',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './controle-atividades.component.html',
  styleUrl: './controle-atividades.component.css',
})
export class ControleAtividadesComponent {
  private readonly api = inject(ControleAtividadesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly aviso = signal('');

  // --- rail
  readonly quadros = signal<ListaDeQuadros>({ meus: [], demais: [], consultores: [] });
  readonly aba = signal<'meus' | 'demais'>('meus');
  readonly filtroCliente = signal('');
  /** Filtro de CONSULTOR da aba "Demais consultores" (pedido em 2026-09-01). 0 = todos. */
  readonly filtroConsultor = signal(0);

  // --- quadro aberto
  readonly codigoAtivo = signal('');
  readonly quadro = signal<QuadroCompleto | null>(null);
  readonly etiquetas = signal<Etiqueta[]>([]);
  readonly consultores = signal<ConsultorPainel[]>([]);
  readonly contatos = signal<ContatoCliente[]>([]);
  /** De QUAL cliente é a lista de contatos que está em memória.
   *
   * Sem isto, `contatos` era um cache sem dono: bastava ter aberto um cartão do cliente A
   * para que o cartão do cliente B oferecesse os contatos de A — a lista só era buscada
   * quando estava vazia, e trocar de quadro não a esvaziava. Guardar a origem é o que faz o
   * "já tenho" significar "já tenho DESTE cliente". */
  private contatosDe = '';

  // --- cartão aberto
  readonly cartaoAberto = signal<number | null>(null);
  readonly textoComentario = signal('');
  readonly textoItem = signal('');
  readonly urlLink = signal('');

  /** Rascunho da edição do cartão. O que está sendo digitado vive AQUI e não no objeto do
   * quadro: várias ações (marcar checklist, comentar, anexar) recarregam o quadro inteiro, e
   * se o texto morasse no cartão recarregado, o que a pessoa está escrevendo sumiria no meio
   * da digitação. */
  readonly rascTitulo = signal('');
  readonly rascDescricao = signal('');
  readonly rascPrazo = signal('');
  readonly rascEtiquetas = signal<string[]>([]);
  readonly salvandoCartao = signal(false);

  // --- criação
  readonly criandoNaLista = signal<number | null>(null);
  readonly tituloNovo = signal('');
  readonly designadoNovo = signal(0);
  readonly abrindoQuadro = signal(false);
  readonly projetos = signal<ProjetoDisponivel[]>([]);
  readonly projetoEscolhido = signal(0);
  readonly termoCliente = signal('');
  readonly clientesAchados = signal<{ codigo: string; cliente: string }[]>([]);

  // --- importação do Trello
  readonly importando = signal(false);
  readonly arquivoTrello = signal<File | null>(null);
  readonly previaTrello = signal<PreviaTrello | null>(null);
  readonly destinos = signal<Record<string, number>>({});
  readonly resultadoImport = signal<ResultadoImportacao | null>(null);
  readonly ocupadoImport = signal(false);

  // --- busca geral
  readonly termoBusca = signal('');
  readonly resultado = signal<AchadoBusca[]>([]);
  readonly buscaInfo = signal('');

  // --- arraste
  private arrastando: number | null = null;
  readonly colunaAlvo = signal<number | null>(null);

  constructor() {
    const cod = this.route.snapshot.paramMap.get('codigo') ?? '';
    void this.iniciar(cod);
  }

  // ---------------------------------------------------------------- derivados

  readonly listaDoRail = computed<QuadroResumo[]>(() => {
    const q = this.quadros();
    const base = this.aba() === 'meus' ? q.meus : q.demais;
    const termo = this.filtroCliente().trim().toLowerCase();
    const consultor = this.filtroConsultor();
    return base.filter((c) => {
      if (consultor && !c.responsaveis.some((r) => r.usuarioId === consultor)) return false;
      if (!termo) return true;
      return (
        c.nomeCliente.toLowerCase().includes(termo) ||
        c.codigoClienteSicla.includes(termo)
      );
    });
  });

  /** Achou na OUTRA aba? Oferecer o pulo é melhor que dizer "nada encontrado". */
  readonly naOutraAba = computed(() => {
    const termo = this.filtroCliente().trim().toLowerCase();
    if (!termo || this.listaDoRail().length) return 0;
    const q = this.quadros();
    const outra = this.aba() === 'meus' ? q.demais : q.meus;
    return outra.filter(
      (c) =>
        c.nomeCliente.toLowerCase().includes(termo) ||
        c.codigoClienteSicla.includes(termo),
    ).length;
  });

  readonly colunas = computed(() => this.quadro()?.listas ?? []);
  readonly podeEditar = computed(() => this.quadro()?.podeEditar ?? false);
  readonly podeInteragir = computed(() => this.quadro()?.podeInteragir ?? false);
  readonly podeCriar = computed(() => this.quadro()?.podeCriarCartao ?? false);
  readonly interno = computed(() => this.quadro()?.interno ?? true);
  readonly soConsulta = computed(() => {
    const q = this.quadro();
    return Boolean(q && q.interno && !q.souResponsavel);
  });
  readonly responsaveisTexto = computed(() =>
    (this.quadro()?.quadro.responsaveis ?? []).map((r) => r.nome).join(', '),
  );

  cartoesDa(lista: ColunaQuadro): CartaoAtividade[] {
    return (this.quadro()?.cartoes ?? [])
      .filter((c) => c.listaId === lista.id)
      .sort((a, b) => a.ordem - b.ordem);
  }

  readonly cartao = computed<CartaoAtividade | null>(() => {
    const id = this.cartaoAberto();
    if (!id) return null;
    return (this.quadro()?.cartoes ?? []).find((c) => c.id === id) ?? null;
  });

  readonly colunaDoCartao = computed(() => {
    const c = this.cartao();
    return this.colunas().find((l) => l.id === c?.listaId) ?? null;
  });

  readonly membrosRech = computed(() =>
    (this.cartao()?.membros ?? []).filter((m) => m.tipo === 'interno'),
  );
  readonly membrosCliente = computed(() =>
    (this.cartao()?.membros ?? []).filter((m) => m.tipo === 'cliente'),
  );

  progresso(c: CartaoAtividade): number {
    if (!c.checklist.length) return 0;
    return Math.round(
      (c.checklist.filter((i) => i.feito).length / c.checklist.length) * 100,
    );
  }
  feitos(c: CartaoAtividade): number {
    return c.checklist.filter((i) => i.feito).length;
  }
  nomeEtiqueta(chave: string): string {
    return this.etiquetas().find((e) => e.chave === chave)?.nome ?? chave;
  }
  /** O prazo já passou? Comparação de texto ISO, que é como a data é guardada. */
  atrasado(c: CartaoAtividade): boolean {
    if (!c.prazo || c.concluido) return false;
    return c.prazo < new Date().toISOString().slice(0, 10);
  }
  dataCurta(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';
  }
  iniciais(nome: string): string {
    const p = nome.trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p.length > 1 ? (p[p.length - 1][0] ?? '') : '')).toUpperCase();
  }

  // ------------------------------------------------------------------- carga

  private async iniciar(codigo: string): Promise<void> {
    try {
      const [lista, etiquetas, consultores] = await Promise.all([
        this.api.quadros(),
        this.api.etiquetas(),
        this.api.consultores(),
      ]);
      this.quadros.set(lista);
      this.etiquetas.set(etiquetas);
      this.consultores.set(consultores);
      // "Meus clientes" sempre selecionada na abertura (regra do usuário). Só cai para
      // "Demais" quando a rota já veio apontando um quadro que não é meu.
      const alvo =
        codigo ||
        lista.meus[0]?.codigoClienteSicla ||
        lista.demais[0]?.codigoClienteSicla ||
        '';
      if (alvo && !lista.meus.some((q) => q.codigoClienteSicla === alvo)) {
        this.aba.set('demais');
      }
      if (alvo) await this.abrirCliente(alvo);
    } catch {
      this.erro.set('Não foi possível carregar o Controle de Atividades.');
    } finally {
      this.carregando.set(false);
    }
  }

  private async recarregarRail(): Promise<void> {
    this.quadros.set(await this.api.quadros());
  }

  async abrirCliente(codigo: string): Promise<void> {
    this.erro.set('');
    this.cartaoAberto.set(null);
    this.codigoAtivo.set(codigo);
    try {
      this.quadro.set(await this.api.quadro(codigo));
      void this.router.navigate(['/atividades', codigo], { replaceUrl: true });
    } catch {
      this.quadro.set(null);
      this.erro.set('Não foi possível abrir este quadro.');
    }
  }

  private async recarregarQuadro(): Promise<void> {
    if (!this.codigoAtivo()) return;
    this.quadro.set(await this.api.quadro(this.codigoAtivo()));
  }

  /** Erro de ação: mostra a mensagem do backend, que é quem sabe o motivo real. */
  private falhou(e: unknown, padrao: string): void {
    const msg = (e as { error?: { message?: string } })?.error?.message;
    this.erro.set(msg || padrao);
  }

  trocarAba(a: 'meus' | 'demais'): void {
    this.aba.set(a);
    this.filtroConsultor.set(0);
  }

  // ------------------------------------------------------------------- busca

  async buscar(): Promise<void> {
    const termo = this.termoBusca().trim();
    if (termo.length < 2) {
      this.resultado.set([]);
      this.buscaInfo.set('');
      return;
    }
    const r = await this.api.buscar(termo);
    this.resultado.set(r.achados);
    this.buscaInfo.set(
      r.total
        ? `${r.total} ${r.total > 1 ? 'cartões' : 'cartão'} em ${r.quadros} ${r.quadros > 1 ? 'quadros' : 'quadro'}` +
          (r.truncado ? ' (mostrando os primeiros)' : '')
        : 'Nada encontrado.',
    );
  }

  limparBusca(): void {
    this.termoBusca.set('');
    this.resultado.set([]);
    this.buscaInfo.set('');
  }

  async irPara(a: AchadoBusca): Promise<void> {
    this.aba.set(
      this.quadros().meus.some((q) => q.codigoClienteSicla === a.codigoClienteSicla)
        ? 'meus'
        : 'demais',
    );
    await this.abrirCliente(a.codigoClienteSicla);
    this.cartaoAberto.set(a.cartaoId);
    this.limparBusca();
  }

  // ------------------------------------------------------------------ cartões

  abrirCartao(id: number): void {
    this.cartaoAberto.set(id);
    this.semearRascunho();
    this.textoComentario.set('');
    this.textoItem.set('');
    this.urlLink.set('');
    // Recarrega quando a lista em memória é de OUTRO cliente (ou ainda não existe).
    if (this.interno() && this.contatosDe !== this.codigoAtivo()) {
      void this.carregarContatos();
    }
  }
  fecharCartao(): void {
    this.cartaoAberto.set(null);
  }

  /** Recarrega o rascunho a partir do cartão salvo — ao abrir e depois de gravar. */
  private semearRascunho(): void {
    const c = this.cartao();
    this.rascTitulo.set(c?.titulo ?? '');
    this.rascDescricao.set(c?.descricao ?? '');
    this.rascPrazo.set(c?.prazo ?? '');
    this.rascEtiquetas.set([...(c?.etiquetas ?? [])]);
  }

  /** Há algo por gravar? É o que faz o botão Salvar aparecer só quando serve para algo. */
  readonly cartaoMudou = computed(() => {
    const c = this.cartao();
    if (!c) return false;
    const mesmasEtiquetas =
      [...this.rascEtiquetas()].sort().join(',') === [...c.etiquetas].sort().join(',');
    return (
      this.rascTitulo().trim() !== c.titulo ||
      this.rascDescricao() !== c.descricao ||
      this.rascPrazo() !== c.prazo ||
      !mesmasEtiquetas
    );
  });

  temEtiqueta(chave: string): boolean {
    return this.rascEtiquetas().includes(chave);
  }

  alternarEtiqueta(chave: string): void {
    const atuais = this.rascEtiquetas();
    this.rascEtiquetas.set(
      atuais.includes(chave)
        ? atuais.filter((e) => e !== chave)
        : [...atuais, chave],
    );
  }

  descartarEdicao(): void {
    this.semearRascunho();
  }

  async salvarCartao(): Promise<void> {
    const c = this.cartao();
    if (!c || !this.cartaoMudou() || this.salvandoCartao()) return;
    const titulo = this.rascTitulo().trim();
    // O título é a identidade do cartão no quadro: um cartão sem título vira uma faixa em
    // branco que ninguém consegue distinguir das outras.
    if (!titulo) {
      this.erro.set('O título do cartão não pode ficar vazio.');
      return;
    }
    this.salvandoCartao.set(true);
    this.erro.set('');
    try {
      await this.api.editarCartao(c.id, {
        titulo,
        descricao: this.rascDescricao().trim(),
        prazo: this.rascPrazo(),
        etiquetas: this.rascEtiquetas(),
      });
      await this.recarregarQuadro();
      this.semearRascunho();
      this.aviso.set('Cartão salvo.');
    } catch (e) {
      this.falhou(e, 'Não foi possível salvar o cartão.');
    } finally {
      this.salvandoCartao.set(false);
    }
  }

  private async carregarContatos(): Promise<void> {
    const codigo = this.codigoAtivo();
    try {
      const lista = await this.api.contatos(codigo);
      // O quadro pode ter mudado enquanto a resposta vinha: só aceita o que ainda é do
      // cliente aberto, senão a resposta lenta de um sobrescreveria a do outro.
      if (this.codigoAtivo() !== codigo) return;
      this.contatos.set(lista);
      this.contatosDe = codigo;
    } catch {
      if (this.codigoAtivo() !== codigo) return;
      this.contatos.set([]); // sem SICLA a tela segue; só não oferece contato.
      this.contatosDe = '';
    }
  }

  comecarCartao(listaId: number): void {
    this.criandoNaLista.set(listaId);
    this.tituloNovo.set('');
    this.designadoNovo.set(0);
  }

  async criarCartao(): Promise<void> {
    const listaId = this.criandoNaLista();
    const titulo = this.tituloNovo().trim();
    if (!listaId || !titulo) return;
    try {
      await this.api.criarCartao({
        listaId,
        titulo,
        designadoUsuarioId: this.designadoNovo() || undefined,
      });
      this.criandoNaLista.set(null);
      this.tituloNovo.set('');
      await this.recarregarQuadro();
      await this.recarregarRail();
    } catch (e) {
      this.falhou(e, 'Não foi possível criar o cartão.');
    }
  }

  async alternarVisibilidade(): Promise<void> {
    const c = this.cartao();
    if (!c) return;
    try {
      await this.api.definirVisibilidade(c.id, !c.visivelCliente);
      this.aviso.set(
        c.visivelCliente
          ? 'Recolhido — o cliente deixou de ver este cartão.'
          : 'Compartilhado com o cliente.',
      );
      await this.recarregarQuadro();
      await this.recarregarRail();
    } catch (e) {
      this.falhou(e, 'Não foi possível alterar a visibilidade.');
    }
  }

  async marcarItem(itemId: number, feito: boolean): Promise<void> {
    const c = this.cartao();
    if (!c) return;
    try {
      await this.api.marcarItem(c.id, itemId, feito);
      await this.recarregarQuadro();
    } catch (e) {
      this.falhou(e, 'Não foi possível marcar o item.');
    }
  }

  async incluirItem(): Promise<void> {
    const c = this.cartao();
    const texto = this.textoItem().trim();
    if (!c || !texto) return;
    await this.api.incluirItem(c.id, texto);
    this.textoItem.set('');
    await this.recarregarQuadro();
  }

  async comentar(): Promise<void> {
    const c = this.cartao();
    const texto = this.textoComentario().trim();
    if (!c || !texto) return;
    try {
      await this.api.comentar(c.id, texto);
      this.textoComentario.set('');
      await this.recarregarQuadro();
    } catch (e) {
      this.falhou(e, 'Não foi possível comentar.');
    }
  }

  async anexarArquivo(ev: Event): Promise<void> {
    const c = this.cartao();
    const input = ev.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!c || !arquivo) return;
    try {
      await this.api.anexar(c.id, arquivo);
      await this.recarregarQuadro();
    } catch (e) {
      this.falhou(e, 'Não foi possível anexar o arquivo.');
    } finally {
      input.value = '';
    }
  }

  async anexarLink(): Promise<void> {
    const c = this.cartao();
    const url = this.urlLink().trim();
    if (!c || !url) return;
    try {
      await this.api.anexarLink(c.id, url);
      this.urlLink.set('');
      await this.recarregarQuadro();
    } catch (e) {
      this.falhou(e, 'Não foi possível anexar o link.');
    }
  }

  async baixarAnexo(anexoId: number, nome: string): Promise<void> {
    const c = this.cartao();
    if (!c) return;
    await this.api.baixarAnexo(c.id, anexoId, nome);
  }

  async removerAnexo(anexoId: number): Promise<void> {
    const c = this.cartao();
    if (!c) return;
    await this.api.removerAnexo(c.id, anexoId);
    await this.recarregarQuadro();
  }

  async incluirConsultor(usuarioId: number): Promise<void> {
    const c = this.cartao();
    const alvo = this.consultores().find((x) => x.usuarioId === usuarioId);
    if (!c || !alvo) return;
    try {
      await this.api.incluirMembro(c.id, {
        tipo: 'interno',
        usuarioId: alvo.usuarioId,
        nome: alvo.nome,
      });
      await this.recarregarQuadro();
    } catch (e) {
      this.falhou(e, 'Não foi possível incluir o consultor.');
    }
  }

  async incluirContato(email: string): Promise<void> {
    const c = this.cartao();
    const alvo = this.contatos().find((x) => x.email === email);
    if (!c || !alvo) return;
    try {
      await this.api.incluirMembro(c.id, {
        tipo: 'cliente',
        nome: alvo.nome,
        email: alvo.email,
        cargo: alvo.cargo,
      });
      await this.recarregarQuadro();
    } catch (e) {
      this.falhou(e, 'Não foi possível incluir o contato.');
    }
  }

  async removerMembro(membroId: number): Promise<void> {
    const c = this.cartao();
    if (!c) return;
    try {
      await this.api.removerMembro(c.id, membroId);
      await this.recarregarQuadro();
    } catch (e) {
      this.falhou(e, 'Não foi possível remover o membro.');
    }
  }

  // ------------------------------------------------------------------ arraste

  aoArrastar(id: number): void {
    this.arrastando = id;
  }
  aoSobrevoar(ev: DragEvent, listaId: number): void {
    if (this.arrastando === null || !this.podeInteragir()) return;
    ev.preventDefault();
    this.colunaAlvo.set(listaId);
  }
  aoSair(): void {
    this.colunaAlvo.set(null);
  }
  async aoSoltar(ev: DragEvent, lista: ColunaQuadro): Promise<void> {
    ev.preventDefault();
    this.colunaAlvo.set(null);
    const id = this.arrastando;
    this.arrastando = null;
    if (id === null) return;
    await this.mover(id, lista, this.cartoesDa(lista).length);
  }

  /** Caminho ACESSÍVEL do arraste — setas movem o cartão entre colunas. É também o caminho
   * que o e2e consegue exercitar de forma estável, porque drag nativo é frágil em teste. */
  async aoTeclar(ev: KeyboardEvent, cartao: CartaoAtividade): Promise<void> {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.abrirCartao(cartao.id);
      return;
    }
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    const cols = this.colunas();
    const i = cols.findIndex((l) => l.id === cartao.listaId);
    const j = ev.key === 'ArrowRight' ? Math.min(i + 1, cols.length - 1) : Math.max(i - 1, 0);
    if (i === j) return;
    await this.mover(cartao.id, cols[j], this.cartoesDa(cols[j]).length);
  }

  private async mover(id: number, lista: ColunaQuadro, indice: number): Promise<void> {
    try {
      await this.api.moverCartao(id, lista.id, indice);
      await this.recarregarQuadro();
      await this.recarregarRail();
    } catch (e) {
      this.falhou(e, 'Não foi possível mover o cartão.');
    }
  }

  // ------------------------------------------------------- importar do Trello

  abrirImportacao(): void {
    this.importando.set(true);
    this.arquivoTrello.set(null);
    this.previaTrello.set(null);
    this.resultadoImport.set(null);
    this.destinos.set({});
  }

  fecharImportacao(): void {
    this.importando.set(false);
  }

  /** Lê o arquivo e mostra o que ENTRARIA. Nada é gravado nesta etapa. */
  async escolherArquivoTrello(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    this.arquivoTrello.set(arquivo);
    this.previaTrello.set(null);
    this.resultadoImport.set(null);
    this.ocupadoImport.set(true);
    this.erro.set('');
    try {
      const p = await this.api.previaTrello(this.codigoAtivo(), arquivo);
      this.previaTrello.set(p);
      // Sugere o de/para por NOME: uma lista "A fazer" do Trello cai na coluna "A fazer" do
      // Painel sem ninguém precisar escolher. O que não casar vira coluna nova.
      const porNome = new Map(
        p.colunasDoQuadro.map((c) => [c.titulo.trim().toLowerCase(), c.id]),
      );
      const sugestao: Record<string, number> = {};
      for (const l of p.listas) {
        const id = porNome.get(l.titulo.trim().toLowerCase());
        if (id) sugestao[l.idTrello] = id;
      }
      this.destinos.set(sugestao);
    } catch (e) {
      this.falhou(e, 'Não foi possível ler o arquivo do Trello.');
    } finally {
      this.ocupadoImport.set(false);
      input.value = '';
    }
  }

  definirDestino(idListaTrello: string, listaId: number): void {
    const atual = { ...this.destinos() };
    if (listaId) atual[idListaTrello] = listaId;
    else delete atual[idListaTrello];
    this.destinos.set(atual);
  }

  destinoDe(idListaTrello: string): number {
    return this.destinos()[idListaTrello] ?? 0;
  }

  async confirmarImportacao(): Promise<void> {
    const arquivo = this.arquivoTrello();
    if (!arquivo || this.ocupadoImport()) return;
    this.ocupadoImport.set(true);
    this.erro.set('');
    try {
      const destinos = Object.entries(this.destinos()).map(([idListaTrello, listaId]) => ({
        idListaTrello,
        listaId,
      }));
      this.resultadoImport.set(
        await this.api.importarTrello(this.codigoAtivo(), arquivo, destinos),
      );
      await this.recarregarQuadro();
      await this.recarregarRail();
    } catch (e) {
      this.falhou(e, 'Não foi possível importar.');
    } finally {
      this.ocupadoImport.set(false);
    }
  }

  // ------------------------------------------------------------ novo quadro

  async comecarQuadro(): Promise<void> {
    this.abrindoQuadro.set(true);
    this.projetoEscolhido.set(0);
    this.termoCliente.set('');
    this.clientesAchados.set([]);
    this.projetos.set(await this.api.projetosDisponiveis());
  }

  /** Busca o cliente no SICLA para pegar o CÓDIGO — o projeto guarda só o nome, e o código
   * é a chave do quadro. Vem pré-preenchida com o cliente do projeto escolhido. */
  async procurarCliente(): Promise<void> {
    const termo = this.termoCliente().trim();
    if (termo.length < 2) {
      this.clientesAchados.set([]);
      return;
    }
    try {
      this.clientesAchados.set(await this.api.clientesSicla(termo));
    } catch {
      this.clientesAchados.set([]);
      this.erro.set('Não foi possível consultar o SICLA agora.');
    }
  }

  /** Escolher o projeto já sugere o termo de busca do cliente. */
  async escolherProjeto(projetoId: number): Promise<void> {
    this.projetoEscolhido.set(projetoId);
    const p = this.projetos().find((x) => x.projetoId === projetoId);
    if (p) {
      this.termoCliente.set(p.cliente);
      await this.procurarCliente();
    }
  }

  async abrirNovoQuadro(codigo: string, nome: string): Promise<void> {
    const projetoId = this.projetoEscolhido();
    if (!projetoId) {
      this.erro.set('Escolha o projeto do cliente.');
      return;
    }
    try {
      await this.api.abrirQuadro(codigo, nome, projetoId);
      this.abrindoQuadro.set(false);
      await this.recarregarRail();
      await this.abrirCliente(codigo);
    } catch (e) {
      this.falhou(e, 'Não foi possível abrir o quadro.');
    }
  }
}
