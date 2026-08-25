import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiDadosService } from '../../core/services/api-dados.service';
import {
  CatalogoDados,
  ClienteApi,
  ConsultaPublicada,
  ConsultaPublicadaResumo,
  EstadoConexao,
  MetricaConsulta,
} from '../../core/models/api-dados.model';

/** Sistema → API de Dados: administra a fronteira única de banco EXTERNO (ADR-0003).
 *
 * Mostra o CATÁLOGO (o que existe para ser consultado, sem o SQL), o estado das CONEXÕES, os
 * CLIENTES DE MÁQUINA (outro sistema da Rech, agente de IA, BI) e o USO por consulta.
 *
 * A autorização de um token é POR CONSULTA: no cadastro marcam-se exatamente os nomes que
 * aquele token poderá chamar — não a conexão inteira.
 *
 * A chave de um cliente aparece UMA vez — na criação e na rotação. Não há como recuperá-la
 * depois: o banco guarda só o hash. */
@Component({
  selector: 'app-api-dados',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './api-dados.component.html',
  styleUrl: './api-dados.component.css',
})
export class ApiDadosComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ApiDadosService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly salvando = signal(false);
  /** Falha SÓ na parte de clientes de máquina — o catálogo e as conexões continuam na tela. */
  readonly avisoClientes = signal<string | null>(null);

  readonly catalogo = signal<CatalogoDados | null>(null);
  readonly conexoes = signal<EstadoConexao[]>([]);
  readonly clientes = signal<ClienteApi[]>([]);
  /** Universo de consultas que um token pode autorizar (o catálogo). */
  readonly consultasDisponiveis = signal<string[]>([]);
  readonly metricas = signal<MetricaConsulta[]>([]);
  /** Consultas criadas PELA TELA — publicadas ou ainda rascunho. Ficam à parte do catálogo
   * porque só elas são editáveis aqui; as de código exigem release. */
  readonly consultasDeTela = signal<ConsultaPublicadaResumo[]>([]);

  /** Chave recém-gerada, em claro. Fica na tela até o Administrador fechar o aviso —
   * é a única oportunidade de copiá-la. */
  readonly chaveNova = signal<{ nome: string; chave: string } | null>(null);

  readonly form = this.fb.nonNullable.group({
    nome: ['', Validators.required],
    consultas: [[] as string[], Validators.required],
    observacao: [''],
  });

  /** Consultas agrupadas por conexão — é como o Administrador raciocina ("o que temos do
   * SICLA?"), não como o catálogo está ordenado. */
  readonly porConexao = computed<{ chave: string; consultas: ConsultaPublicada[] }[]>(() => {
    const lista = this.catalogo()?.consultas ?? [];
    const mapa = new Map<string, ConsultaPublicada[]>();
    for (const c of lista) {
      const atual = mapa.get(c.conexao) ?? [];
      atual.push(c);
      mapa.set(c.conexao, atual);
    }
    return [...mapa.entries()].map(([chave, consultas]) => ({ chave, consultas }));
  });

  constructor() {
    void this.carregar();
  }

  rotuloConexao(chave: string): string {
    return this.conexoes().find((c) => c.chave === chave)?.rotulo ?? chave;
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.avisoClientes.set(null);
    try {
      // Catálogo e conexões são o NÚCLEO: não dependem de tabela nenhuma e sempre
      // respondem. Carregam separado do resto de propósito.
      const [catalogo, conexoes] = await Promise.all([
        this.service.catalogo(),
        this.service.conexoes(),
      ]);
      this.catalogo.set(catalogo);
      this.conexoes.set(conexoes);
    } catch {
      this.erro.set('Não foi possível carregar a API de Dados.');
      this.carregando.set(false);
      return;
    }

    // Clientes de máquina dependem da tabela `api_clientes`, criada pela migration
    // `ApiClientes`. Antes de ela rodar em produção, esta parte falha — e não pode levar a
    // tela junto: o Administrador precisa justamente desta tela para ver o catálogo e
    // diagnosticar. Degrada com aviso, não com página em branco.
    try {
      const [clientes, disponiveis, metricas, deTela] = await Promise.all([
        this.service.clientes(),
        this.service.consultasDisponiveis(),
        this.service.metricas(),
        this.service.listarConsultas(),
      ]);
      this.clientes.set(clientes);
      this.consultasDisponiveis.set(disponiveis);
      this.metricas.set(metricas);
      this.consultasDeTela.set(deTela);
    } catch {
      this.avisoClientes.set(
        'Não foi possível carregar os clientes de máquina e as consultas da tela. Se a API de Dados acabou de entrar, rode as migrations (cd backend && npm run migration:run).',
      );
    } finally {
      this.carregando.set(false);
    }
  }

  alternarConsulta(nome: string, marcada: boolean): void {
    const atuais = this.form.controls.consultas.value;
    const novas = marcada
      ? [...new Set([...atuais, nome])]
      : atuais.filter((c) => c !== nome);
    this.form.controls.consultas.setValue(novas);
  }

  consultaMarcada(nome: string): boolean {
    return this.form.controls.consultas.value.includes(nome);
  }

  /** Marca/desmarca de uma vez todas as consultas de uma conexão — atalho para quem vai
   * liberar um bloco inteiro, sem obrigar 18 cliques. */
  alternarGrupo(chave: string, marcar: boolean): void {
    const nomes = this.consultasDoGrupo(chave);
    const atuais = this.form.controls.consultas.value;
    const novas = marcar
      ? [...new Set([...atuais, ...nomes])]
      : atuais.filter((c) => !nomes.includes(c));
    this.form.controls.consultas.setValue(novas);
  }

  /** Nomes disponíveis de uma conexão, na ordem do catálogo. */
  consultasDoGrupo(chave: string): string[] {
    const disponiveis = this.consultasDisponiveis();
    return (this.catalogo()?.consultas ?? [])
      .filter((c) => c.conexao === chave && disponiveis.includes(c.nome))
      .map((c) => c.nome);
  }

  grupoInteiroMarcado(chave: string): boolean {
    const nomes = this.consultasDoGrupo(chave);
    return nomes.length > 0 && nomes.every((n) => this.consultaMarcada(n));
  }

  async criar(): Promise<void> {
    if (this.form.invalid || this.form.controls.consultas.value.length === 0) {
      this.erro.set('Informe o nome e ao menos uma consulta que o token poderá chamar.');
      return;
    }
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const criado = await this.service.criarCliente(this.form.getRawValue());
      this.chaveNova.set({ nome: criado.nome, chave: criado.chave });
      this.form.reset({ nome: '', consultas: [], observacao: '' });
      await this.recarregarClientes();
    } catch {
      this.erro.set('Não foi possível criar o cliente.');
    } finally {
      this.salvando.set(false);
    }
  }

  async definirAtivo(cliente: ClienteApi, ativo: boolean): Promise<void> {
    const acao = ativo ? 'reativar' : 'revogar';
    if (!confirm(`Confirma ${acao} o acesso de "${cliente.nome}"?`)) return;
    try {
      await this.service.definirAtivo(cliente.id, ativo);
      this.aviso.set(`Acesso de "${cliente.nome}" ${ativo ? 'reativado' : 'revogado'}.`);
      await this.recarregarClientes();
    } catch {
      this.erro.set(`Não foi possível ${acao} o cliente.`);
    }
  }

  async rotacionar(cliente: ClienteApi): Promise<void> {
    if (
      !confirm(
        `Gerar uma chave nova para "${cliente.nome}"? A atual deixa de valer imediatamente.`,
      )
    ) {
      return;
    }
    try {
      const novo = await this.service.rotacionar(cliente.id);
      this.chaveNova.set({ nome: novo.nome, chave: novo.chave });
      await this.recarregarClientes();
    } catch {
      this.erro.set('Não foi possível rotacionar a chave.');
    }
  }

  async excluir(cliente: ClienteApi): Promise<void> {
    if (
      !confirm(
        `Apagar o cadastro de "${cliente.nome}"? Revogar preserva o histórico de acesso — apagar não.`,
      )
    ) {
      return;
    }
    try {
      await this.service.excluir(cliente.id);
      this.aviso.set(`Cadastro de "${cliente.nome}" apagado.`);
      await this.recarregarClientes();
    } catch {
      this.erro.set('Não foi possível apagar o cadastro.');
    }
  }

  async limparCache(): Promise<void> {
    try {
      const n = await this.service.limparCache();
      this.aviso.set(`${n} entrada(s) de cache descartada(s).`);
    } catch {
      this.erro.set('Não foi possível limpar o cache.');
    }
  }

  fecharChave(): void {
    this.chaveNova.set(null);
  }

  private async recarregarClientes(): Promise<void> {
    this.clientes.set(await this.service.clientes());
  }
}
