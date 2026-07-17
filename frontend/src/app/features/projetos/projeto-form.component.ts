import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CriarProjetoPayload, Etapa, SITUACOES, Situacao } from '../../core/models/projeto.model';
import { ProjetosService } from '../../core/services/projetos.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { DesignacaoService } from '../../core/services/designacao.service';
import { AuthService } from '../../core/services/auth.service';
import { Cabecalho } from '../../core/models/painel.model';
import { Documento, DOC_TIPOS, EventoProjeto, SlugDocumentoFiel } from '../../core/models/documento.model';
import { podeGerar, PERFIS_DESIGNA_CONSULTORES } from '../../core/constants/perfis';

type Aba = 'execucao' | 'resumo' | 'dados' | 'com' | 'hist';

const ICONE_EVENTO: Record<string, string> = {
  nota: '#ic-pencil',
  etapa: '#ic-arrow-right',
  documento: '#ic-file',
  email: '#ic-mail',
  alerta: '#ic-bell',
};

function baixarNoNavegador(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'app-projeto-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, DatePipe, NgTemplateOutlet],
  templateUrl: './projeto-form.component.html',
  styleUrl: './projeto-form.component.css',
})
export class ProjetoFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjetosService);
  private readonly documentosService = inject(DocumentosService);
  private readonly designacaoService = inject(DesignacaoService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly situacoes = SITUACOES;
  readonly docTipos = DOC_TIPOS;
  readonly iconeEvento = ICONE_EVENTO;

  readonly salvando = signal(false);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly salvo = signal(false);
  readonly avancando = signal(false);
  readonly gerando = signal<string | null>(null);

  readonly projetoId = signal<number | null>(null);
  readonly cabecalho = signal<Cabecalho | null>(null);
  readonly documentos = signal<Documento[]>([]);
  readonly eventos = signal<EventoProjeto[]>([]);
  readonly designacoesAtuais = signal<Record<string, string>>({});
  readonly aba = signal<Aba>('execucao');
  readonly mostrarHistoricoResumo = signal(false);

  novaNota = '';
  tipoAnexo = 'levantamento';
  enviandoAnexo = false;

  readonly perfil = computed(() => this.auth.usuario()?.perfil);
  readonly podeDesignarConsultores = computed(() => {
    const p = this.perfil();
    return !!p && PERFIS_DESIGNA_CONSULTORES.includes(p);
  });

  readonly designacoesLista = computed(() =>
    Object.entries(this.designacoesAtuais()).map(([modulo, consultor]) => ({ modulo, consultor })),
  );

  readonly temCronograma = computed(() => this.documentos().some((d) => d.tipo === 'cronograma'));
  readonly temChecklist = computed(() => this.documentos().some((d) => d.tipo === 'checklist'));
  readonly temTermo = computed(() => this.documentos().some((d) => d.tipo === 'termo'));

  readonly form = this.fb.nonNullable.group({
    cliente: ['', Validators.required],
    cnpj: [''],
    numeroProjeto: [''],
    numeroProposta: [''],
    ramo: [''],
    responsavel: [''],
    consultor: [''],
    gci: [''],
    etapa: ['Agendamento' as Etapa],
    situacao: ['Em andamento' as Situacao],
    modulos: [''],
    horasCobradas: [''],
    horasBonificadas: [''],
    dataInicio: [''],
    dataLevantamento: [''],
    dataUsoOficial: [''],
    dataEncerramento: [''],
    contatoNome: [''],
    contatoEmail: [''],
    contatoTel: [''],
    contatos: [''],
    observacoes: [''],
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'novo') {
      const id = Number(idParam);
      this.projetoId.set(id);
      void this.carregarTudo(id);
    } else {
      this.carregando.set(false);
    }
  }

  async carregarTudo(id: number): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [projeto, cabecalho, documentos, eventos, consultoresView] = await Promise.all([
        this.service.buscar(id),
        this.documentosService.cabecalho(id),
        this.documentosService.listar(id),
        this.documentosService.eventos(id),
        this.designacaoService.obterConsultores(id).catch(() => ({ modulos: [], consultores: [], atuais: {} })),
      ]);
      this.form.patchValue(projeto);
      this.cabecalho.set(cabecalho);
      this.documentos.set(documentos);
      this.eventos.set(eventos);
      this.designacoesAtuais.set(consultoresView.atuais);
    } catch {
      this.erro.set('Não foi possível carregar o projeto.');
    } finally {
      this.carregando.set(false);
    }
  }

  irParaAba(aba: Aba): void {
    this.aba.set(aba);
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }

  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const dto = this.form.getRawValue() as CriarProjetoPayload;
      const id = this.projetoId();
      const salvoProjeto = id ? await this.service.atualizar(id, dto) : await this.service.criar(dto);
      if (id) {
        this.salvo.set(true);
        await this.carregarTudo(id);
      } else {
        await this.router.navigate(['/projetos', salvoProjeto.id]);
      }
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar o projeto.'));
    } finally {
      this.salvando.set(false);
    }
  }

  podeGerar(tipo: string): boolean {
    return podeGerar(tipo, this.perfil());
  }

  async gerarDocumento(slug: SlugDocumentoFiel): Promise<void> {
    const id = this.projetoId();
    if (!id || this.gerando()) return;
    this.gerando.set(slug);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const arquivo = await this.documentosService.gerarLayout(id, slug);
      baixarNoNavegador(arquivo.blob, arquivo.filename);
      this.aviso.set(`${arquivo.filename} gerado e anexado à ficha.`);
      await this.carregarTudo(id);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível gerar o documento.'));
    } finally {
      this.gerando.set(null);
    }
  }

  /** Gera, em sequência, todo documento obrigatório do gate da etapa atual que ainda não
   * existe — equivalente ao botão "Preparar N doc(s) pendente(s)" de projeto_ficha.html
   * (lá é uma rota própria; aqui é o mesmo resultado via chamadas sequenciais ao endpoint
   * de geração já existente). 'projeto' fica de fora — precisa passar pela escolha de
   * origem (Gerar Projeto), igual webapp/routes_geracao.py:projeto_gerar_pendentes. */
  async gerarPendentes(): Promise<void> {
    const id = this.projetoId();
    const cab = this.cabecalho();
    if (!id || !cab || this.gerando()) return;
    const tiposBulk: SlugDocumentoFiel[] = ['levantamento', 'cronograma', 'termo'];
    const pendentes = cab.gate.itens
      .filter((i) => !i.ok && tiposBulk.includes(i.tipo as SlugDocumentoFiel))
      .map((i) => i.tipo as SlugDocumentoFiel);
    for (const tipo of pendentes) {
      await this.gerarDocumento(tipo);
    }
  }

  async avancarEtapa(): Promise<void> {
    const id = this.projetoId();
    if (!id || this.avancando()) return;
    this.avancando.set(true);
    this.erro.set(null);
    try {
      await this.documentosService.avancar(id);
      await this.carregarTudo(id);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível avançar a etapa.'));
    } finally {
      this.avancando.set(false);
    }
  }

  async adicionarNota(): Promise<void> {
    const id = this.projetoId();
    if (!id || !this.novaNota.trim()) return;
    try {
      await this.documentosService.adicionarNota(id, this.novaNota.trim());
      this.novaNota = '';
      await this.carregarTudo(id);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível registrar a nota.'));
    }
  }

  async anexarDocumento(evento: Event): Promise<void> {
    const id = this.projetoId();
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!id || !arquivo) return;
    this.enviandoAnexo = true;
    try {
      await this.documentosService.anexar(id, this.tipoAnexo, arquivo);
      await this.carregarTudo(id);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível anexar o documento.'));
    } finally {
      this.enviandoAnexo = false;
      input.value = '';
    }
  }

  async baixarDocumento(doc: Documento): Promise<void> {
    try {
      const arquivo = await this.documentosService.baixar(doc.id, doc.arquivo);
      baixarNoNavegador(arquivo.blob, arquivo.filename);
    } catch {
      this.erro.set('Não foi possível baixar o documento.');
    }
  }

  ehExcluivel(doc: Documento): boolean {
    // Mesma regra de webapp/db.py:tipo_excluivel — só bloqueia se algo POSTERIOR existir.
    const ordem: Record<string, number> = { levantamento: 0, projeto: 1, cronograma: 2, checklist: 2, termo: 3 };
    const rank = ordem[doc.tipo];
    if (rank === undefined) return true;
    return !this.documentos().some((d) => (ordem[d.tipo] ?? -1) > rank);
  }

  async excluirDocumento(doc: Documento): Promise<void> {
    const id = this.projetoId();
    if (!id || !confirm('Excluir este documento para gerá-lo novamente?')) return;
    try {
      await this.documentosService.excluirDocumento(doc.id);
      await this.carregarTudo(id);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível excluir o documento.'));
    }
  }

  async excluirProjeto(): Promise<void> {
    const id = this.projetoId();
    if (!id) return;
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita. Excluir o projeto e todo o seu histórico?')) return;
    await this.service.excluir(id);
    await this.router.navigate(['/projetos']);
  }
}
