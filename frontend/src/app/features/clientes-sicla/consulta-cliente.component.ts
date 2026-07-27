import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import {
  ClienteSicla,
  ClientesSiclaService,
  ModuloSelecionado,
  ResultadoCadastroCliente,
} from '../../core/services/clientes-sicla.service';
import {
  ModuloSicla,
  ModulosSiclaService,
} from '../../core/services/modulos-sicla.service';

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
  private readonly modulosService = inject(ModulosSiclaService);
  private readonly auth = inject(AuthService);

  // Busca de cliente
  readonly termo = signal('');
  readonly buscando = signal(false);
  readonly resultados = signal<ClienteSicla[]>([]);
  readonly msgBusca = signal<string | null>(null);
  readonly buscou = signal(false);

  // Busca e marcação de módulos contratados
  readonly termoModulo = signal('');
  readonly buscandoModulo = signal(false);
  readonly resultadosModulo = signal<ModuloSicla[]>([]);
  readonly msgModulo = signal<string | null>(null);
  readonly modulosSelecionados = signal<ModuloSelecionado[]>([]);

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
    this.modulosSelecionados.set([]);
    this.resultadosModulo.set([]);
    this.termoModulo.set('');
    this.msgModulo.set(null);
  }

  // ===== Módulos contratados (consulta + marcação no SICLA) =====

  async buscarModulos(): Promise<void> {
    const t = this.termoModulo().trim();
    if (t.length < 1) {
      this.msgModulo.set('Digite o código ou a descrição do módulo.');
      return;
    }
    this.buscandoModulo.set(true);
    this.msgModulo.set(null);
    try {
      const r = await this.modulosService.buscar(t);
      this.resultadosModulo.set(r.modulos);
      if (!r.ok) {
        this.msgModulo.set(r.mensagem || 'Não foi possível consultar os módulos.');
      } else if (r.modulos.length === 0) {
        this.msgModulo.set('Nenhum módulo encontrado para esse termo.');
      } else {
        this.msgModulo.set(null);
      }
    } catch (e) {
      this.msgModulo.set(this.mensagemErro(e, 'Falha ao consultar os módulos.'));
      this.resultadosModulo.set([]);
    } finally {
      this.buscandoModulo.set(false);
    }
  }

  /** Marcado = já está na lista de contratados (pelo código efetivo). */
  moduloMarcado(codigo: string): boolean {
    return this.modulosSelecionados().some((m) => m.codigo === codigo);
  }

  /** Marca/desmarca um módulo da lista de contratados. */
  toggleModulo(m: ModuloSicla): void {
    const atual = this.modulosSelecionados();
    if (atual.some((x) => x.codigo === m.codigo)) {
      this.modulosSelecionados.set(atual.filter((x) => x.codigo !== m.codigo));
    } else {
      this.modulosSelecionados.set([
        ...atual,
        { codigo: m.codigo, descricao: m.descricao, obs: '' },
      ]);
    }
  }

  removerModulo(codigo: string): void {
    this.modulosSelecionados.set(
      this.modulosSelecionados().filter((m) => m.codigo !== codigo),
    );
  }

  /** Atualiza a observação de um módulo já marcado. */
  setObs(codigo: string, obs: string): void {
    this.modulosSelecionados.set(
      this.modulosSelecionados().map((m) =>
        m.codigo === codigo ? { ...m, obs } : m,
      ),
    );
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
      const r = await this.service.cadastrar({
        ...dados,
        modulosSelecionados: this.modulosSelecionados(),
      });
      this.sucesso.set({ resultado: r, cliente: dados.cliente });
      this.selecionado.set(null);
      this.resultados.set([]);
      this.termo.set('');
      this.buscou.set(false);
      this.form.reset();
      this.modulosSelecionados.set([]);
      this.resultadosModulo.set([]);
      this.termoModulo.set('');
      this.msgModulo.set(null);
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
