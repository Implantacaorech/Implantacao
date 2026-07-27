import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import {
  ClienteSicla,
  ClientesSiclaService,
  ResultadoCadastroCliente,
} from '../../core/services/clientes-sicla.service';

/** Passo 1 do processo — a ENTRADA. O Comercial busca o cliente no SICLA (por código ou
 * descrição), seleciona, a ficha vem pré-preenchida e ele completa o que faltar. Ao concluir,
 * cria o projeto e conclui o passo 1 (o que avisa o Administrativo). Substitui a antiga
 * leitura automática de e-mail. */
@Component({
  selector: 'app-consulta-cliente',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './consulta-cliente.component.html',
  styleUrl: './consulta-cliente.component.css',
})
export class ConsultaClienteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ClientesSiclaService);
  private readonly auth = inject(AuthService);

  // Busca
  readonly termo = signal('');
  readonly buscando = signal(false);
  readonly resultados = signal<ClienteSicla[]>([]);
  readonly msgBusca = signal<string | null>(null);
  readonly buscou = signal(false);

  // Seleção / cadastro
  readonly selecionado = signal<ClienteSicla | null>(null);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly sucesso = signal<{ resultado: ResultadoCadastroCliente; cliente: string } | null>(
    null,
  );

  /** O Comercial não enxerga a carteira; para ele, o sucesso é só a confirmação. Perfis
   * internos ganham o link para abrir o projeto no fluxo. */
  readonly podeAbrirProjeto = computed(
    () => this.auth.usuario()?.perfil !== 'Comercial',
  );

  readonly form = this.fb.nonNullable.group({
    cliente: ['', Validators.required],
    cnpj: [''],
    numeroProjeto: [''],
    numeroProposta: [''],
    ramo: [''],
    responsavel: [''],
    contatoNome: [''],
    contatoEmail: [''],
    contatoTel: [''],
    comercialEmail: [''],
    horasCobradas: [''],
    horasBonificadas: [''],
    modulos: [''],
    observacoes: [''],
  });

  async buscar(): Promise<void> {
    const t = this.termo().trim();
    if (t.length < 2) {
      this.msgBusca.set('Digite ao menos 2 caracteres (código ou descrição).');
      return;
    }
    this.buscando.set(true);
    this.msgBusca.set(null);
    try {
      const r = await this.service.buscar(t);
      this.buscou.set(true);
      this.resultados.set(r.clientes);
      if (!r.ok) {
        this.msgBusca.set(r.mensagem || 'Não foi possível consultar o SICLA.');
      } else if (r.clientes.length === 0) {
        this.msgBusca.set('Nenhum cliente encontrado para esse termo.');
      } else {
        this.msgBusca.set(null);
      }
    } catch (e) {
      this.msgBusca.set(this.mensagemErro(e, 'Falha ao consultar o SICLA.'));
      this.resultados.set([]);
    } finally {
      this.buscando.set(false);
    }
  }

  selecionar(c: ClienteSicla): void {
    this.selecionado.set(c);
    this.sucesso.set(null);
    this.erro.set(null);
    // Pré-preenche o que veio do SICLA. O código do cliente no SICLA alimenta o número do
    // projeto (padrão da sigla: 3 letras + CNPJ + código no SICLA). O resto o Comercial
    // completa.
    this.form.patchValue({
      cliente: c.cliente || c.fantasia || '',
      cnpj: c.cnpj || '',
      numeroProjeto: c.codigo || '',
      ramo: c.ramo || '',
      responsavel: c.responsavel || '',
      contatoNome: c.contatoNome || '',
      contatoEmail: c.contatoEmail || '',
      contatoTel: c.contatoTel || '',
    });
    // Sugere o e-mail do próprio Comercial logado como retorno do passo 3.
    const meu = this.auth.usuario();
    if (meu && !this.form.getRawValue().comercialEmail) {
      this.form.patchValue({ comercialEmail: meu.login.includes('@') ? meu.login : '' });
    }
  }

  limparSelecao(): void {
    this.selecionado.set(null);
    this.form.reset();
  }

  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const dados = this.form.getRawValue();
      const r = await this.service.cadastrar(dados);
      this.sucesso.set({ resultado: r, cliente: dados.cliente });
      this.selecionado.set(null);
      this.resultados.set([]);
      this.termo.set('');
      this.buscou.set(false);
      this.form.reset();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível cadastrar o cliente.'));
    } finally {
      this.salvando.set(false);
    }
  }

  private mensagemErro(e: unknown, padrao: string): string {
    if (e instanceof HttpErrorResponse && typeof e.error?.message === 'string') {
      return e.error.message;
    }
    return padrao;
  }
}
