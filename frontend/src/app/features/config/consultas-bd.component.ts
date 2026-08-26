import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfigDisponibilidadeService } from '../../core/services/config-disponibilidade.service';
import { LinhaOcupacao } from '../../core/models/config-disponibilidade.model';
import { ConsultaBdService } from '../../core/services/consulta-bd.service';
import { ConsultaBD, ResultadoExecucaoSql } from '../../core/models/consulta-bd.model';
import { InstanciaService } from '../../core/services/instancia.service';

type Aba = 'disponibilidade' | 'portal-db' | 'nova' | string;

@Component({
  selector: 'app-consultas-bd',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './consultas-bd.component.html',
  styleUrl: './consultas-bd.component.css',
})
export class ConsultasBdComponent {
  private readonly fb = inject(FormBuilder);
  private readonly disponibilidadeService = inject(ConfigDisponibilidadeService);
  private readonly service = inject(ConsultaBdService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly instancia = inject(InstanciaService);

  /** As abas de CONEXÃO (Disponibilidade/Oracle e Portal Rech/MySQL) só existem no **Portal
   * API**. No Painel elas saíram em 2026-08-26, a pedido do usuário: dado de conexão com
   * banco não fica no portal do usuário — aqui ele consulta por TOKEN. O que sobra nesta
   * tela são as consultas em si, que alimentam os Dashboards. */
  readonly portalApi = computed(() => this.instancia.portalApi());

  readonly dialetos = ['mysql', 'oracle', 'postgresql', 'sqlserver'];

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly testando = signal(false);
  readonly excluindo = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly configurado = signal(false);
  readonly amostra = signal<LinhaOcupacao[] | null>(null);
  readonly resultadoTeste = signal<ResultadoExecucaoSql | null>(null);

  readonly consultas = signal<ConsultaBD[]>([]);
  // Sem as abas de conexão, a primeira aba útil do Painel é a de consultas — abrir numa aba
  // que não existe deixaria a tela em branco.
  readonly aba = signal<Aba>(
    this.instancia.portalApi() ? 'disponibilidade' : 'nova',
  );

  readonly consultaAtual = computed(() => this.consultas().find((c) => c.slug === this.aba()) ?? null);

  readonly formDisponibilidade = this.fb.nonNullable.group({
    tipo: ['oracle'],
    host: [''],
    porta: [''],
    banco: [''],
    usuario: [''],
    senha: [''],
    url: [''],
    select: [''],
    ativo: [false],
    oracleThick: [false],
    oracleLibDir: [''],
  });

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

  // Conexão com o BANCO DO PORTAL RECH (MySQL) — as consultas com conexao='portal' (ex.:
  // a do painel Visitas do Portal no BI) rodam nela.
  readonly portalDbConfigurado = signal(false);
  readonly formPortalDb = this.fb.nonNullable.group({
    host: [''],
    porta: [''],
    banco: [''],
    usuario: [''],
    senha: [''],
    url: [''],
    ativo: [false],
  });

  constructor() {
    const abaRota = this.route.snapshot.paramMap.get('slug');
    void this.carregarTudo(abaRota || 'disponibilidade');
  }

  async carregarTudo(aba: Aba): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.consultas.set(await this.service.listar());
      const slugs = new Set(this.consultas().map((c) => c.slug));
      // No Painel as abas de conexão não existem: cair nelas deixaria a tela em branco.
      // A aba de partida passa a ser a primeira consulta — ou "nova", se não houver
      // nenhuma.
      const conexao = aba === 'disponibilidade' || aba === 'portal-db';
      const padrao = this.portalApi()
        ? 'disponibilidade'
        : (this.consultas()[0]?.slug ?? 'nova');
      this.aba.set(
        (conexao && !this.portalApi()) || !(conexao || aba === 'nova' || slugs.has(aba))
          ? padrao
          : aba,
      );
      await this.carregarAbaAtual();
    } catch {
      this.erro.set('Não foi possível carregar as consultas.');
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregarAbaAtual(): Promise<void> {
    const aba = this.aba();
    if (aba === 'disponibilidade') {
      const status = await this.disponibilidadeService.status();
      this.formDisponibilidade.patchValue({ ...status, senha: '' });
      this.configurado.set(status.configurado);
    } else if (aba === 'portal-db') {
      const cfg = await this.service.portalDbStatus();
      this.formPortalDb.patchValue({ ...cfg, senha: '' });
      this.portalDbConfigurado.set(cfg.ativo && (!!cfg.url || (!!cfg.host && !!cfg.banco)));
    } else if (aba === 'nova') {
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
    this.amostra.set(null);
    this.resultadoTeste.set(null);
    this.aba.set(aba);
    await this.carregarAbaAtual();
    await this.router
      .navigate(aba === 'disponibilidade' ? ['/config/consultas-bd'] : ['/config/consultas-bd', aba])
      .catch(() => undefined);
  }

  /** Salva (e opcionalmente testa) a conexão com o banco do Portal Rech. */
  async salvarPortalDb(testar: boolean): Promise<void> {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const dados = this.formPortalDb.getRawValue();
      const dto: Partial<typeof dados> = { ...dados };
      if (!dto.senha) delete dto.senha;
      const cfg = await this.service.portalDbSalvar(dto);
      this.portalDbConfigurado.set(cfg.ativo && (!!cfg.url || (!!cfg.host && !!cfg.banco)));
      this.formPortalDb.patchValue({ senha: '' });
      this.aviso.set('Conexão salva.');
      if (testar) {
        this.testando.set(true);
        const r = await this.service.portalDbTestar();
        if (r.ok) this.aviso.set(r.mensagem);
        else this.erro.set(r.mensagem);
      }
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar a conexão do banco do Portal.'));
    } finally {
      this.salvando.set(false);
      this.testando.set(false);
    }
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }

  async salvarDisponibilidade(testar: boolean): Promise<void> {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const dados = this.formDisponibilidade.getRawValue();
      const dto: Partial<typeof dados> = { ...dados };
      if (!dto.senha) delete dto.senha;
      const status = await this.disponibilidadeService.salvar(dto);
      this.configurado.set(status.configurado);
      this.formDisponibilidade.patchValue({ senha: '' });
      this.aviso.set('Configuração salva.');
      if (testar) {
        this.testando.set(true);
        const r = await this.disponibilidadeService.testar();
        if (r.ok) {
          this.aviso.set(r.mensagem);
          this.amostra.set(r.amostra);
        } else {
          this.erro.set(r.mensagem);
        }
      }
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar a configuração.'));
    } finally {
      this.salvando.set(false);
      this.testando.set(false);
    }
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
    if (this.formConsulta.invalid || this.salvando() || slug === 'disponibilidade' || slug === 'nova') return;
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
    if (slug === 'disponibilidade' || slug === 'nova') return;
    const nome = this.consultaAtual()?.nome ?? slug;
    if (!confirm(`Excluir a consulta '${nome}'? Isso também remove a análise correspondente dos Dashboards.`)) return;
    this.excluindo.set(true);
    try {
      await this.service.excluir(slug);
      await this.carregarTudo('disponibilidade');
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível excluir a consulta.'));
    } finally {
      this.excluindo.set(false);
    }
  }
}
