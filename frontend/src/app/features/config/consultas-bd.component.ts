import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConsultaBdService } from '../../core/services/consulta-bd.service';
import { ConsultaBD, ResultadoExecucaoSql } from '../../core/models/consulta-bd.model';

/** Uma aba é o slug de uma consulta, ou `nova`. As abas de CONEXÃO saíram em 2026-08-26:
 * cadastrar conexão passou a ser a tela Conexões do Portal API, e manter as duas seria
 * manter dois lugares para a mesma verdade. */
type Aba = 'nova' | string;

@Component({
  selector: 'app-consultas-bd',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './consultas-bd.component.html',
  styleUrl: './consultas-bd.component.css',
})
export class ConsultasBdComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ConsultaBdService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly dialetos = ['mysql', 'oracle', 'postgresql', 'sqlserver'];

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly testando = signal(false);
  readonly excluindo = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly resultadoTeste = signal<ResultadoExecucaoSql | null>(null);

  readonly consultas = signal<ConsultaBD[]>([]);
  readonly aba = signal<Aba>('nova');

  readonly consultaAtual = computed(() => this.consultas().find((c) => c.slug === this.aba()) ?? null);

  readonly formNova = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    slug: [''],
    sql: [''],
  });

  readonly formConsulta = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    sql: ['', Validators.required],
    colunaData: [''],
    colunaSituacao: [''],
    mostrarGrafico: [false],
    conexao: ['sicla'],
  });

  constructor() {
    const abaRota = this.route.snapshot.paramMap.get('slug');
    void this.carregarTudo(abaRota || '');
  }

  async carregarTudo(aba: Aba): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.consultas.set(await this.service.listar());
      const slugs = new Set(this.consultas().map((c) => c.slug));
      // Sem as abas de conexão, a aba de partida é a primeira consulta — ou "nova", se não
      // houver nenhuma. Abrir numa aba que não existe deixaria a tela em branco.
      const padrao = this.consultas()[0]?.slug ?? 'nova';
      this.aba.set(aba === 'nova' || slugs.has(aba) ? aba : padrao);
      await this.carregarAbaAtual();
    } catch {
      this.erro.set('Não foi possível carregar as consultas.');
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregarAbaAtual(): Promise<void> {
    const aba = this.aba();
    if (aba === 'nova') {
      this.formNova.reset({ nome: '', slug: '', sql: '' });
    } else {
      const c = this.consultaAtual();
      if (c) this.formConsulta.patchValue(c);
    }
  }

  async trocarAba(aba: Aba): Promise<void> {
    if (aba === this.aba()) return;
    this.aviso.set(null);
    this.erro.set(null);
    this.resultadoTeste.set(null);
    this.aba.set(aba);
    await this.carregarAbaAtual();
    await this.router
      .navigate(['/config/consultas-bd', aba])
      .catch(() => undefined);
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }

  async criarConsulta(): Promise<void> {
    if (this.formNova.invalid || this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const dados = this.formNova.getRawValue();
      const nova = await this.service.criar(dados);
      await this.carregarTudo(nova.slug);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível criar a consulta.'));
    } finally {
      this.salvando.set(false);
    }
  }

  async salvarConsulta(testar: boolean): Promise<void> {
    const slug = this.aba();
    if (this.formConsulta.invalid || this.salvando() || slug === 'nova') return;
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    this.resultadoTeste.set(null);
    try {
      const dados = this.formConsulta.getRawValue();
      await this.service.atualizar(slug, dados);
      this.consultas.set(await this.service.listar());
      this.aviso.set('Configuração salva.');
      if (testar) {
        this.testando.set(true);
        this.resultadoTeste.set(await this.service.testar(slug));
      }
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar a consulta.'));
    } finally {
      this.salvando.set(false);
      this.testando.set(false);
    }
  }

  async excluirConsulta(): Promise<void> {
    const slug = this.aba();
    if (slug === 'nova') return;
    const nome = this.consultaAtual()?.nome ?? slug;
    if (!confirm(`Excluir a consulta '${nome}'? Isso também remove a análise correspondente dos Dashboards.`)) return;
    this.excluindo.set(true);
    try {
      await this.service.excluir(slug);
      await this.carregarTudo('');
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível excluir a consulta.'));
    } finally {
      this.excluindo.set(false);
    }
  }
}
