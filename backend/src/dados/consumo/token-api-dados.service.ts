import { Injectable, NotFoundException } from '@nestjs/common';
import { TokenApiDados } from '../../database/entities/token-api-dados.entity';
import { TokenApiDadosRepository } from './repositories/token-api-dados.repository';

/** Um token como a TELA o vê: **sem a chave**. Volta só o prefixo, que é o suficiente para
 * a pessoa reconhecer qual token é qual sem que o segredo trafegue de novo. */
export interface TokenResumo {
  id: number;
  nome: string;
  url: string;
  prefixo: string;
  consultas: string[];
  ativo: boolean;
  observacao: string;
  criadoEm: Date;
  ultimoUsoEm: Date | null;
  ultimoErro: string | null;
}

export interface SalvarToken {
  nome: string;
  url: string;
  /** Em branco na edição MANTÉM a chave atual — mesmo contrato das senhas de conexão. */
  chave?: string;
  consultas: string[];
  observacao?: string;
  ativo?: boolean;
}

/** Cadastro dos tokens que o **Portal Implantação** usa para consultar o **Portal API**.
 *
 * Camada Repository do ADR-0002: nenhum controller toca o repositório, e nada aqui lança
 * HTTP a não ser o 404 de "esse id não existe", que é resposta e não falha. */
@Injectable()
export class TokenApiDadosService {
  constructor(private readonly repo: TokenApiDadosRepository) {}

  /** O prefixo público de `rd_<prefixo>_<segredo>`. Chave em formato inesperado não vira
   * exceção: mostra-se o começo dela, que é o bastante para reconhecer. */
  static prefixoDe(chave: string): string {
    const partes = (chave || '').split('_');
    return partes.length >= 3 ? partes[1] : (chave || '').slice(0, 12);
  }

  private resumir(t: TokenApiDados): TokenResumo {
    return {
      id: t.id,
      nome: t.nome,
      url: t.url,
      prefixo: TokenApiDadosService.prefixoDe(t.chave),
      consultas: this.listaDe(t.consultas),
      ativo: t.ativo,
      observacao: t.observacao,
      criadoEm: t.criadoEm,
      ultimoUsoEm: t.ultimoUsoEm,
      ultimoErro: t.ultimoErro,
    };
  }

  private listaDe(csv: string | null): string[] {
    return (csv ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }

  async listar(): Promise<TokenResumo[]> {
    return (await this.repo.listar()).map((t) => this.resumir(t));
  }

  /** Os tokens utilizáveis, **com a chave** — só para o serviço remoto. Não há rota que
   * devolva isto. */
  async ativos(): Promise<TokenApiDados[]> {
    return this.repo.ativos();
  }

  async criar(dados: SalvarToken): Promise<TokenResumo> {
    return this.resumir(
      await this.repo.criar({
        nome: dados.nome.trim(),
        url: this.normalizarUrl(dados.url),
        chave: (dados.chave ?? '').trim(),
        consultas: dados.consultas.join(','),
        observacao: (dados.observacao ?? '').trim(),
        ativo: dados.ativo ?? true,
        ultimoUsoEm: null,
        ultimoErro: null,
      }),
    );
  }

  async atualizar(id: number, dados: SalvarToken): Promise<TokenResumo> {
    const t = await this.exigir(id);
    t.nome = dados.nome.trim();
    t.url = this.normalizarUrl(dados.url);
    // Chave em branco mantém a atual: é o que permite corrigir o nome ou a URL sem ter o
    // segredo em mãos de novo (ele nunca voltou para a tela).
    if ((dados.chave ?? '').trim()) t.chave = (dados.chave ?? '').trim();
    t.consultas = dados.consultas.join(',');
    t.observacao = (dados.observacao ?? '').trim();
    if (dados.ativo !== undefined) t.ativo = dados.ativo;
    return this.resumir(await this.repo.salvar(t));
  }

  async definirAtivo(id: number, ativo: boolean): Promise<TokenResumo> {
    const t = await this.exigir(id);
    t.ativo = ativo;
    return this.resumir(await this.repo.salvar(t));
  }

  async remover(id: number): Promise<void> {
    await this.repo.remover((await this.exigir(id)).id);
  }

  /** Marca uso ou falha. Best-effort: o registro é diagnóstico, e falhar ao gravá-lo não
   * pode derrubar a consulta que acabou de dar certo. */
  async registrarUso(id: number, erro: string | null): Promise<void> {
    try {
      await this.repo.registrarUso(id, new Date(), erro);
    } catch {
      // silêncio proposital
    }
  }

  private async exigir(id: number): Promise<TokenApiDados> {
    const t = await this.repo.porId(id);
    if (!t) throw new NotFoundException(`Token ${id} não existe.`);
    return t;
  }

  /** Sem barra no fim e sem o `/api` — quem monta o caminho é o serviço remoto. Colar a URL
   * do navegador (com `/config/api-dados` no fim) é o erro mais provável, e ele vira um 404
   * incompreensível se não for aparado aqui. */
  private normalizarUrl(url: string): string {
    return (url || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api(\/.*)?$/i, '')
      .replace(/\/config(\/.*)?$/i, '');
  }
}
