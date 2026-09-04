import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CriarUsuarioPayload,
  PAPEL_CLIENTE,
  PERFIS,
  ROTULO_PERFIL,
  TecnicoSicla,
  Usuario,
} from '../../core/models/usuario.model';
import { UsuariosService } from '../../core/services/usuarios.service';
import { PresencaService } from '../../core/services/presenca.service';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { temPapel } from '../../core/constants/perfis';
import {
  FiltrosSalvos,
  deSignal,
  filtrosSalvos,
} from '../../core/utils/filtros-salvos';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UsuariosService);
  private readonly auth = inject(AuthService);
  private readonly presenca = inject(PresencaService);
  private readonly router = inject(Router);

  /** Quantas pessoas estão no Painel agora — o selo do botão "Online". */
  readonly online = this.presenca.online;

  /** Abre a tela de acompanhamento. */
  verOnline(): void {
    void this.router.navigate(['/usuarios', 'online']);
  }

  readonly perfis = PERFIS;
  readonly rotuloPerfil = ROTULO_PERFIL;

  /** Exclusão é só do Administrador. A tela inteira já é do menu Sistema (fixo-ADM), mas a
   * regra fica explícita aqui para o botão não vazar se a tela um dia abrir para mais
   * papéis — e o backend revalida de qualquer forma (rota @Roles ADM). */
  readonly podeExcluir = computed(() => temPapel(this.auth.usuario(), 'ADM'));

  /** Linha do próprio logado não ganha o botão: autoexclusão é recusada pelo backend. */
  readonly idLogado = computed(() => this.auth.usuario()?.sub ?? null);

  readonly excluindoId = signal<number | null>(null);

  /** Papéis marcados do usuário em edição. A pessoa acumula cargos — é comum ser GCI e
   * Levantador ao mesmo tempo —, então isto é uma LISTA, não um select. */
  readonly papeisMarcados = signal<string[]>(['Consultor']);

  marcado(papel: string): boolean {
    return this.papeisMarcados().includes(papel);
  }

  alternarPapel(papel: string, marcado: boolean): void {
    this.papeisMarcados.update((atual) => {
      if (!marcado) return atual.filter((p) => p !== papel);
      // `Cliente` é EXCLUSIVO: marcar o cliente desmarca todo o resto, e marcar qualquer
      // papel interno tira o cliente. Espelha a regra que o backend impõe na gravação —
      // aqui é só para a tela não deixar montar a combinação que ele vai recusar.
      if (papel === PAPEL_CLIENTE) return [PAPEL_CLIENTE];
      return [...new Set([...atual.filter((p) => p !== PAPEL_CLIENTE), papel])];
    });
    this.ajustarObrigatorios();
  }

  /** É um cadastro de cliente (externo)? Muda quais campos são obrigatórios. */
  readonly ehCliente = computed(() =>
    this.papeisMarcados().includes(PAPEL_CLIENTE),
  );

  /** O código obrigatório é o do TÉCNICO no cadastro interno e o do CLIENTE no externo —
   * um cliente não tem código de técnico, e um técnico não tem cliente vinculado. */
  private ajustarObrigatorios(): void {
    const cliente = this.papeisMarcados().includes(PAPEL_CLIENTE);
    const sicla = this.form.controls.codigoSicla;
    const doCliente = this.form.controls.codigoClienteSicla;
    sicla.setValidators(cliente ? [] : [Validators.required]);
    doCliente.setValidators(cliente ? [Validators.required] : []);
    sicla.updateValueAndValidity();
    doCliente.updateValueAndValidity();
  }
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly usuarios = signal<Usuario[]>([]);
  readonly usuarioId = signal<number | null>(null);
  /** O formulário fica FECHADO por padrão: só abre no "＋ Novo usuário" ou no "Editar" de
   * uma linha. Com 250+ usuários, um formulário sempre aberto no topo só empurra a lista
   * para baixo e não deixa claro o que está sendo editado. */
  readonly formAberto = signal(false);

  // ===== Filtros da lista do Painel =====
  // Com 250+ usuários vindos do SICLA, a lista só é utilizável filtrada. O setor é o corte
  // natural (GRM-Implantação, GRM-Suporte, GPD-Desenvolvimento…).
  readonly filtroSetor = signal('');
  readonly filtroNome = signal('');

  /** Setores presentes no cadastro, com a contagem — alimenta o select. */
  readonly setores = computed(() => {
    const contagem = new Map<string, number>();
    for (const u of this.usuarios()) {
      const s = (u.setorAtuacao || '').trim();
      if (s) contagem.set(s, (contagem.get(s) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([setor, total]) => ({ setor, total }));
  });

  /** Quantos ficaram sem setor (ADM, conta de serviço, cadastros manuais). */
  readonly semSetor = computed(
    () => this.usuarios().filter((u) => !(u.setorAtuacao || '').trim()).length,
  );

  readonly usuariosFiltrados = computed(() => {
    const setor = this.filtroSetor();
    const nome = this.filtroNome().trim().toLowerCase();
    return this.usuarios().filter((u) => {
      const uSetor = (u.setorAtuacao || '').trim();
      if (setor === '__sem__' ? uSetor !== '' : setor && uSetor !== setor) {
        return false;
      }
      if (
        nome &&
        ![u.nome, u.email, u.login, u.codigoSicla, u.modulosCapacitados].some(
          (c) => (c || '').toLowerCase().includes(nome),
        )
      ) {
        return false;
      }
      return true;
    });
  });

  limparFiltros(): void {
    this.filtroSetor.set('');
    this.filtroNome.set('');
    // Esquece a preferência, em vez de gravar "nenhum filtro": "Limpar" quer dizer voltar ao
    // padrão da tela, não fixar o vazio como escolha.
    void this.salvos.descartar();
  }

  /** Índice código SICLA → usuário do Painel. É o que liga a lista do SICLA ao cadastro
   * daqui, para o "já existe" vir acompanhado do botão Editar. Indexa também sem os zeros
   * à esquerda, porque o código volta do Oracle às vezes com padding ("007" × "7"). */
  private readonly usuarioPorCodigoSicla = computed(() => {
    const mapa = new Map<string, Usuario>();
    for (const u of this.usuarios()) {
      const codigo = (u.codigoSicla || '').trim();
      if (!codigo) continue;
      mapa.set(codigo, u);
      const semZeros = codigo.replace(/^0+/, '');
      if (semZeros && !mapa.has(semZeros)) mapa.set(semZeros, u);
    }
    return mapa;
  });

  /** Usuário já cadastrado para este técnico do SICLA, se houver. */
  usuarioDoTecnico(codigo: string): Usuario | undefined {
    const c = (codigo || '').trim();
    return this.usuarioPorCodigoSicla().get(c) ?? this.usuarioPorCodigoSicla().get(c.replace(/^0+/, ''));
  }

  readonly form = this.fb.nonNullable.group({
    nome: [''],
    email: ['', [Validators.required, Validators.email]],
    login: [''],
    codigoSicla: ['', Validators.required],
    codigoClienteSicla: [''],
    modulosCapacitados: [''],
    setorAtuacao: [''],
    perfil: ['Consultor' as Usuario['perfil']],
    senha: [''],
    ativo: [true],
  });

  // ===== Técnicos do SICLA (LISTA_TECNICOS) — a fonte deste cadastro =====
  readonly tecnicos = signal<TecnicoSicla[]>([]);
  readonly carregandoTecnicos = signal(false);
  readonly importando = signal(false);
  readonly erroSicla = signal<string | null>(null);
  readonly filtroSicla = signal('');
  /** Mostra só quem ainda NÃO tem cadastro no Painel — o caso do dia a dia (entrou gente
   * nova na Rech). O filtro é aplicado no servidor. */
  readonly soNovos = signal(false);
  /** Códigos SICLA marcados para importar. Vazio = importa o que está listado. */
  readonly selecionados = signal<string[]>([]);

  /** Filtros da lista salvos por usuário logado. Com 250+ usuários vindos do SICLA, cada um
   * trabalha sempre no mesmo recorte (o seu setor) — reescolher a cada visita era ruído.
   *
   * `soNovos`/`filtroSicla` são do painel do SICLA, que só busca sob demanda: restaurados,
   * eles ficam prontos para o próximo "Buscar" sem disparar consulta ao Oracle na abertura. */
  private readonly salvos: FiltrosSalvos = filtrosSalvos('usuarios', {
    filtroSetor: deSignal(this.filtroSetor),
    filtroNome: deSignal(this.filtroNome),
    filtroSicla: deSignal(this.filtroSicla),
    soNovos: deSignal(this.soNovos),
  });

  constructor() {
    void this.carregar();
    // Contagem do selo "Online". Uma leitura só ao abrir a tela: quem quer acompanhar de
    // verdade clica no botão e vai para a tela que se atualiza sozinha — repetir aqui só
    // gastaria requisição para mexer num número no canto.
    void this.presenca.atualizarContagem();
  }

  /** Busca a lista de técnicos no SICLA. É sob demanda (não roda ao abrir a tela) porque
   * depende da conexão Oracle, que pode estar fora e não deve travar o cadastro. */
  async carregarTecnicos(): Promise<void> {
    this.carregandoTecnicos.set(true);
    this.erroSicla.set(null);
    this.selecionados.set([]);
    try {
      const r = await this.service.listarTecnicosSicla(
        this.filtroSicla(),
        this.soNovos(),
      );
      this.tecnicos.set(r.tecnicos);
      if (!r.ok) this.erroSicla.set(r.mensagem);
      else if (r.tecnicos.length === 0)
        this.erroSicla.set(
          this.soNovos()
            ? 'Nenhum técnico novo no SICLA — todos já estão cadastrados no Painel.'
            : 'Nenhum técnico encontrado no SICLA com esse filtro.',
        );
    } catch {
      this.erroSicla.set('Não foi possível consultar a lista de técnicos no SICLA.');
      this.tecnicos.set([]);
    } finally {
      this.carregandoTecnicos.set(false);
    }
  }

  /** Atalho: liga o "só novos" e busca. É o botão que responde "entrou alguém novo?". */
  async buscarNovos(): Promise<void> {
    this.soNovos.set(true);
    await this.carregarTecnicos();
  }

  /** Alterna o "só novos" e recarrega, para o filtro valer sobre a lista inteira do SICLA
   * (e não só sobre o que já está na tela). */
  async alternarSoNovos(valor: boolean): Promise<void> {
    this.soNovos.set(valor);
    await this.carregarTecnicos();
  }

  selecionado(codigo: string): boolean {
    return this.selecionados().includes(codigo);
  }

  alternarSelecao(codigo: string, marcado: boolean): void {
    this.selecionados.update((atual) =>
      marcado ? [...new Set([...atual, codigo])] : atual.filter((c) => c !== codigo),
    );
  }

  marcarTodos(marcado: boolean): void {
    this.selecionados.set(marcado ? this.tecnicos().map((t) => t.codigo) : []);
  }

  /** Importa para `usuarios`: os marcados, ou tudo o que está LISTADO se nada estiver
   * marcado. Manda sempre a lista explícita de códigos — com o filtro "só novos" ligado,
   * deixar o servidor decidir importaria os 250 do SICLA em vez dos que estão na tela.
   * Quem já existe é atualizado; quem é novo entra com a senha padrão. */
  async importar(): Promise<void> {
    if (this.importando()) return;
    this.importando.set(true);
    this.erroSicla.set(null);
    this.aviso.set(null);
    try {
      const marcados = this.selecionados();
      const codigos =
        marcados.length > 0 ? marcados : this.tecnicos().map((t) => t.codigo);
      if (codigos.length === 0) return;
      const r = await this.service.importarTecnicos(codigos);
      if (!r.ok) {
        this.erroSicla.set(r.mensagem);
        return;
      }
      const detalhe = r.ignorados.length
        ? ` Sem e-mail no SICLA (não importados): ${r.ignorados
            .map((i) => i.nome || i.codigo)
            .join(', ')}.`
        : '';
      this.aviso.set(r.mensagem + detalhe);
      this.selecionados.set([]);
      await Promise.all([this.carregar(), this.carregarTecnicos()]);
    } catch {
      this.erroSicla.set('Não foi possível importar os técnicos do SICLA.');
    } finally {
      this.importando.set(false);
    }
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.usuarios.set(await this.service.listar());
    } catch {
      this.erro.set('Não foi possível carregar os usuários.');
    } finally {
      this.carregando.set(false);
    }
  }

  editar(u: Usuario): void {
    this.usuarioId.set(u.id);
    this.papeisMarcados.set(
      (u.perfis || u.perfil)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
    );
    this.form.patchValue({ ...u, senha: '' });
    this.ajustarObrigatorios();
    this.erro.set(null);
    this.formAberto.set(true);
    this.focarFormulario();
  }

  /** Abre o formulário em branco (botão ＋). */
  novo(): void {
    this.limpar();
    this.erro.set(null);
    this.aviso.set(null);
    this.formAberto.set(true);
    this.focarFormulario();
  }

  /** Fecha o formulário e descarta o que estava sendo editado. */
  fechar(): void {
    this.limpar();
    this.formAberto.set(false);
  }

  /** Rola até o formulário depois que o Angular o renderiza — sem isto, editar uma linha
   * do fim da lista abre um painel fora da tela. */
  private focarFormulario(): void {
    setTimeout(() => {
      document.getElementById('form-usuario')?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  limpar(): void {
    this.usuarioId.set(null);
    this.papeisMarcados.set(['Consultor']);
    this.form.reset({
      nome: '',
      email: '',
      login: '',
      codigoSicla: '',
      codigoClienteSicla: '',
      modulosCapacitados: '',
      setorAtuacao: '',
      perfil: 'Consultor',
      senha: '',
      ativo: true,
    });
    this.ajustarObrigatorios();
  }

  /** Exclusão definitiva, com confirmação. Erro do backend (autoexclusão, designação em
   * projeto) aparece com a mensagem dele, que orienta a desativar em vez de excluir. */
  async excluir(u: Usuario): Promise<void> {
    if (this.excluindoId() !== null) return;
    const nome = u.nome || u.login;
    if (
      !confirm(
        `Excluir DEFINITIVAMENTE o usuário "${nome}"? Esta ação não tem volta — ` +
          'para afastar alguém mantendo o histórico, desmarque o campo Ativo.',
      )
    ) {
      return;
    }
    this.excluindoId.set(u.id);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      await this.service.excluir(u.id);
      // Se o excluído estava aberto no formulário, fecha para não salvar em cima de um
      // registro que não existe mais.
      if (this.usuarioId() === u.id) this.fechar();
      this.aviso.set(`Usuário "${nome}" excluído.`);
      await this.carregar();
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível excluir o usuário.',
      );
    } finally {
      this.excluindoId.set(null);
    }
  }

  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando()) return;
    const dados = this.form.getRawValue();
    if (!this.usuarioId() && (!dados.senha || dados.senha.length < 6)) {
      this.erro.set('Informe uma senha com pelo menos 6 caracteres.');
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const papeis = this.papeisMarcados();
      const dto = {
        ...dados,
        perfis: papeis as CriarUsuarioPayload['perfis'],
        // O papel PRINCIPAL é o primeiro marcado — é o que aparece onde só cabe um
        // rótulo (listagem, timeline). Se nada foi marcado, mantém o do formulário.
        perfil: (papeis[0] ?? dados.perfil) as CriarUsuarioPayload['perfil'],
      } as CriarUsuarioPayload;
      if (!dto.senha) delete (dto as Partial<CriarUsuarioPayload>).senha;
      const id = this.usuarioId();
      if (id) await this.service.atualizar(id, dto);
      else await this.service.criar(dto);
      this.aviso.set('Salvo.');
      this.fechar();
      await this.carregar();
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar o usuário.',
      );
    } finally {
      this.salvando.set(false);
    }
  }
}
