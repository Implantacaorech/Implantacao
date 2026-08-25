import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiDadosService } from '../../core/services/api-dados.service';
import {
  AnaliseConsulta,
  ChaveConexao,
  ParametroConsulta,
  TIPOS_PARAMETRO,
  TipoParametroApi,
} from '../../core/models/api-dados.model';

/** Portal de Conexões → **criar/editar consulta da API**.
 *
 * O operador cola o SELECT e clica em Testar. O sistema roda com limite 1 e devolve os
 * `:binds` que o texto cita e as COLUNAS que o banco respondeu — ninguém digita a lista de
 * campos. Ao operador resta escolher o tipo de cada parâmetro e o teto de linhas.
 *
 * Publicar é um passo à parte, e só ele exige contrato completo: sem publicar, a consulta é
 * um rascunho que serve aos Dashboards, como as que já existiam. */
@Component({
  selector: 'app-api-dados-consulta',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './api-dados-consulta.component.html',
  styleUrl: './api-dados-consulta.component.css',
})
export class ApiDadosConsultaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ApiDadosService);
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly tipos = TIPOS_PARAMETRO;
  readonly carregando = signal(false);
  readonly testando = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly erros = signal<string[]>([]);
  readonly aviso = signal<string | null>(null);
  readonly analise = signal<AnaliseConsulta | null>(null);

  /** Slug em edição; vazio = consulta nova. */
  readonly slugEditando = signal('');

  /** Parâmetros do contrato. Os NOMES vêm do Testar; o tipo é escolha do operador. */
  readonly parametros = signal<ParametroConsulta[]>([]);
  readonly colunas = signal<string[]>([]);
  /** Valor de exemplo por bind, só para o Testar rodar. */
  readonly exemplos = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    slug: ['', Validators.required],
    nome: ['', Validators.required],
    conexao: ['sicla' as ChaveConexao, Validators.required],
    sql: ['', Validators.required],
    nomeApi: [''],
    limiteLinhas: [500],
    cacheSegundos: [0],
    publicada: [false],
  });

  constructor() {
    const slug = this.rota.snapshot.paramMap.get('slug') ?? '';
    if (slug) void this.carregar(slug);
  }

  async carregar(slug: string): Promise<void> {
    this.carregando.set(true);
    try {
      const c = await this.service.obterConsulta(slug);
      this.slugEditando.set(c.slug);
      this.form.patchValue({
        slug: c.slug,
        nome: c.nome,
        conexao: c.conexao,
        sql: c.sql,
        nomeApi: c.nomeApi,
        limiteLinhas: c.limiteLinhas || 500,
        cacheSegundos: c.cacheSegundos,
        publicada: c.publicada,
      });
      this.parametros.set(c.parametros);
      this.colunas.set(c.colunas);
    } catch {
      this.erro.set('Não foi possível carregar a consulta.');
    } finally {
      this.carregando.set(false);
    }
  }

  exemploDe(bind: string): string {
    return this.exemplos()[bind] ?? '';
  }

  definirExemplo(bind: string, valor: string): void {
    this.exemplos.set({ ...this.exemplos(), [bind]: valor });
  }

  /** Roda o SELECT com limite 1 e reconcilia a lista de parâmetros com os binds achados:
   * mantém o tipo já escolhido para quem continua no SQL, acrescenta o que apareceu e
   * descarta o que sumiu. */
  async testar(): Promise<void> {
    this.testando.set(true);
    this.erro.set(null);
    this.erros.set([]);
    try {
      const r = await this.service.analisarConsulta({
        conexao: this.form.controls.conexao.value,
        sql: this.form.controls.sql.value,
        exemplos: this.exemplos(),
      });
      this.analise.set(r);
      const anteriores = this.parametros();
      this.parametros.set(
        r.binds.map(
          (nome) =>
            anteriores.find((p) => p.nome === nome) ?? {
              nome,
              tipo: 'texto' as TipoParametroApi,
              obrigatorio: true,
              descricao: '',
            },
        ),
      );
      if (r.ok) this.colunas.set(r.colunas);
      else this.erro.set(r.mensagem);
    } catch {
      this.erro.set('Não foi possível testar a consulta.');
    } finally {
      this.testando.set(false);
    }
  }

  definirTipo(nome: string, tipo: string): void {
    this.parametros.set(
      this.parametros().map((p) =>
        p.nome === nome ? { ...p, tipo: tipo as TipoParametroApi } : p,
      ),
    );
  }

  definirObrigatorio(nome: string, obrigatorio: boolean): void {
    this.parametros.set(
      this.parametros().map((p) => (p.nome === nome ? { ...p, obrigatorio } : p)),
    );
  }

  definirDescricao(nome: string, descricao: string): void {
    this.parametros.set(
      this.parametros().map((p) => (p.nome === nome ? { ...p, descricao } : p)),
    );
  }

  async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.erro.set('Preencha identificador, nome e o SELECT.');
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    this.erros.set([]);
    try {
      const v = this.form.getRawValue();
      const slug = await this.service.salvarConsulta({
        ...v,
        parametros: this.parametros(),
        colunas: this.colunas(),
      });
      this.aviso.set(
        v.publicada
          ? 'Consulta salva e publicada no catálogo da API.'
          : 'Consulta salva (ainda não publicada).',
      );
      this.slugEditando.set(slug);
    } catch (e: unknown) {
      // O backend devolve a LISTA de problemas de contrato; mostrar todos de uma vez evita
      // o vaivém de corrigir um por vez.
      const corpo = (e as { error?: { message?: string | string[] } })?.error
        ?.message;
      if (Array.isArray(corpo)) this.erros.set(corpo);
      else this.erro.set(corpo ?? 'Não foi possível salvar a consulta.');
    } finally {
      this.salvando.set(false);
    }
  }

  async excluir(): Promise<void> {
    const slug = this.slugEditando();
    if (!slug) return;
    if (!confirm(`Apagar a consulta "${slug}"? Quem a consome deixa de recebê-la.`)) {
      return;
    }
    try {
      await this.service.excluirConsulta(slug);
      await this.router.navigate(['/config/api-dados']);
    } catch {
      this.erro.set('Não foi possível apagar a consulta.');
    }
  }
}
