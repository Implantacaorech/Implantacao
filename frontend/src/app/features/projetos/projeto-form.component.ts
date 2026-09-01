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
import { Documento, EventoProjeto } from '../../core/models/documento.model';

type Aba = 'resumo' | 'dados' | 'com' | 'hist';

const ICONE_EVENTO: Record<string, string> = {
  nota: '#ic-pencil',
  etapa: '#ic-arrow-right',
  documento: '#ic-file',
  email: '#ic-mail',
  alerta: '#ic-bell',
};

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
  readonly iconeEvento = ICONE_EVENTO;

  readonly salvando = signal(false);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly salvo = signal(false);

  readonly projetoId = signal<number | null>(null);
  /** Levantamento ou Demonstração (passo 1). Fora do formulário de propósito: quem grava é o
   * cadastro do cliente; aqui é só leitura. Vazio nos projetos anteriores ao campo. */
  readonly tipoDemanda = signal<string>('');
  readonly cabecalho = signal<Cabecalho | null>(null);
  readonly documentos = signal<Documento[]>([]);
  readonly eventos = signal<EventoProjeto[]>([]);
  readonly designacoesAtuais = signal<Record<string, string>>({});
  readonly aba = signal<Aba>('dados');

  novaNota = '';

  readonly perfil = computed(() => this.auth.usuario()?.perfil);

  readonly designacoesLista = computed(() =>
    Object.entries(this.designacoesAtuais()).map(([modulo, consultor]) => ({ modulo, consultor })),
  );

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
    // O DADO PRINCIPAL (a ficha) carrega primeiro e sozinho: nunca deve ficar vazio só
    // porque uma chamada secundária (cabeçalho/documentos/eventos) falhou.
    try {
      const projeto = await this.service.buscar(id);
      this.form.patchValue(projeto);
      this.tipoDemanda.set(projeto.tipoDemanda ?? '');
    } catch {
      this.erro.set('Não foi possível carregar o projeto.');
      this.carregando.set(false);
      return;
    }
    // Secundárias: cada uma com fallback próprio — degradam sem derrubar a ficha.
    const [cabecalho, documentos, eventos, consultoresView] = await Promise.all([
      this.documentosService.cabecalho(id).catch(() => null),
      this.documentosService.listar(id).catch(() => []),
      this.documentosService.eventos(id).catch(() => []),
      this.designacaoService
        .obterConsultores(id)
        .catch(() => ({ modulos: [], consultores: [], atuais: {} })),
    ]);
    if (cabecalho) this.cabecalho.set(cabecalho);
    this.documentos.set(documentos);
    this.eventos.set(eventos);
    this.designacoesAtuais.set(consultoresView.atuais);
    this.carregando.set(false);
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

  async excluirProjeto(): Promise<void> {
    const id = this.projetoId();
    if (!id) return;
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita. Excluir o projeto e todo o seu histórico?')) return;
    await this.service.excluir(id);
    await this.router.navigate(['/projetos']);
  }
}
