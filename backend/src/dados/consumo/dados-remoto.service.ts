import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { TokenApiDados } from '../../database/entities/token-api-dados.entity';
import { ResultadoBruto } from '../conexoes/conexoes.service';
import { DelegadoRemoto } from './delegado-remoto';
import { TokenApiDadosService } from './token-api-dados.service';

/** Teto de páginas de uma consulta remota. O Portal API pagina em 5.000 e as consultas de
 * teto maior (extrato de horas, horas aplicadas, visitas) precisam de mais de uma volta —
 * mas um `temMais` que nunca fica falso penduraria o handler. 20 páginas cobrem os
 * 100.000 registros do maior teto do catálogo com folga. */
const MAX_PAGINAS = 20;
const TAMANHO_PAGINA = 5000;
const TIMEOUT_MS = 30_000;

/** Quanto tempo a lista de tokens fica em memória. Curto: cadastrar um token na tela tem de
 * valer quase de imediato, e a leitura é uma tabela minúscula. */
const TTL_TOKENS_MS = 15_000;

interface RespostaExecutar {
  data?: {
    colunas?: string[];
    linhas?: Record<string, unknown>[];
    paginacao?: { temMais?: boolean };
  };
}

/** CONSUMO REMOTO — o Portal Implantação pedindo dado ao **Portal API** pelo túnel.
 *
 * É a peça que fecha o desenho das duas instâncias: com um token ativo cadastrado, o Painel
 * deixa de abrir conexão com o Oracle/MySQL e passa a pedir a consulta **pelo nome** à
 * instância interna. Nenhum módulo de negócio percebe a troca — todos continuam chamando
 * `DadosService.consultar(nome, parametros)`.
 *
 * Enquanto **não** houver token ativo, este serviço se declara inativo e nada muda: é o que
 * permite cadastrar, testar e só então virar a chave, sem janela de indisponibilidade. */
@Injectable()
export class DadosRemotoService implements DelegadoRemoto {
  private readonly logger = new Logger('DadosRemotoService');
  private cache: { ts: number; tokens: TokenApiDados[] } | null = null;

  constructor(
    private readonly tokens: TokenApiDadosService,
    private readonly http: HttpService,
  ) {}

  invalidar(): void {
    this.cache = null;
  }

  private async carregar(): Promise<TokenApiDados[]> {
    const agora = Date.now();
    if (this.cache && agora - this.cache.ts < TTL_TOKENS_MS) {
      return this.cache.tokens;
    }
    let tokens: TokenApiDados[] = [];
    try {
      tokens = (await this.tokens.ativos()).filter(
        (t) => t.url.trim() && t.chave.trim(),
      );
    } catch (e) {
      // Tabela ausente (migration não rodou) não pode derrubar o Painel: sem tokens, ele
      // simplesmente continua consultando local, que é o comportamento de sempre.
      this.logger.error(
        `Falha ao ler os tokens da API de Dados; consumo remoto desligado: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
    this.cache = { ts: agora, tokens };
    return tokens;
  }

  async ativo(): Promise<boolean> {
    return (await this.carregar()).length > 0;
  }

  async cobre(nome: string): Promise<boolean> {
    return Boolean(await this.tokenPara(nome));
  }

  /** O token que autoriza esta consulta. Com vários cadastrados, ganha o primeiro que a
   * cobre — a lista é do Administrador e a ordem é a de cadastro. */
  private async tokenPara(nome: string): Promise<TokenApiDados | undefined> {
    const alvo = (nome || '').trim();
    return (await this.carregar()).find((t) =>
      t.consultas
        .split(',')
        .map((c) => c.trim())
        .includes(alvo),
    );
  }

  async consultar(
    nome: string,
    parametros: Record<string, unknown>,
  ): Promise<ResultadoBruto> {
    const token = await this.tokenPara(nome);
    if (!token) {
      return {
        ok: false,
        mensagem:
          `Nenhum token ativo autoriza a consulta "${nome}". ` +
          'Cadastre-a no Portal API e cole o token em Sistema → Tokens da API de Dados.',
        colunas: [],
        linhas: [],
      };
    }

    const linhas: Record<string, unknown>[] = [];
    let colunas: string[] = [];
    try {
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        const corpo = await this.pedir(token, nome, parametros, pagina);
        colunas = corpo.colunas?.length ? corpo.colunas : colunas;
        linhas.push(...(corpo.linhas ?? []));
        if (!corpo.paginacao?.temMais) break;
        if (pagina === MAX_PAGINAS) {
          // Silêncio aqui viraria número errado numa tela de BI. Denuncia e segue com o que
          // veio — mesma escolha do `truncadoNoLimite` local.
          this.logger.warn(
            `Consulta remota "${nome}" ainda tinha páginas depois de ${MAX_PAGINAS} — resultado pode estar incompleto.`,
          );
        }
      }
      void this.tokens.registrarUso(token.id, null);
      return {
        ok: true,
        mensagem: `${linhas.length} linha(s) via Portal API.`,
        colunas,
        linhas,
      };
    } catch (e) {
      const mensagem = this.mensagemDaFalha(e, token);
      void this.tokens.registrarUso(token.id, mensagem);
      this.invalidar();
      return { ok: false, mensagem, colunas: [], linhas: [] };
    }
  }

  private async pedir(
    token: TokenApiDados,
    nome: string,
    parametros: Record<string, unknown>,
    pagina: number,
  ): Promise<NonNullable<RespostaExecutar['data']>> {
    const url = `${token.url}/api/dados/v1/consultas/${encodeURIComponent(nome)}/executar`;
    const res = await firstValueFrom(
      this.http.post<RespostaExecutar>(
        url,
        { parametros, pagina, tamanho: TAMANHO_PAGINA },
        { headers: { 'X-API-Key': token.chave }, timeout: TIMEOUT_MS },
      ),
    );
    return res.data?.data ?? { colunas: [], linhas: [] };
  }

  /** Traduz a falha para o que o Administrador precisa fazer. Um token revogado do outro
   * lado é o caso mais comum, e "401" sozinho não diz isso a ninguém. */
  private mensagemDaFalha(e: unknown, token: TokenApiDados): string {
    const erro = e as AxiosError<{ message?: string | string[] }>;
    const status = erro?.response?.status;
    const detalhe = erro?.response?.data?.message;
    const texto = Array.isArray(detalhe) ? detalhe.join(' | ') : detalhe;

    if (status === 401) {
      return `O Portal API recusou o token "${token.nome}" (401) — ele foi revogado ou rotacionado. Gere outro e atualize o cadastro.`;
    }
    if (status === 403) {
      return `O token "${token.nome}" não autoriza esta consulta (403). Marque-a no cadastro do token, no Portal API.`;
    }
    if (status === 404) {
      return `O Portal API não conhece esta consulta (404). Confira o nome no catálogo dele.`;
    }
    if (!status) {
      return `Não foi possível falar com o Portal API em ${token.url}: ${
        erro?.message ?? String(e)
      }. Confira o endereço e se a instância está no ar.`;
    }
    return `O Portal API respondeu ${status}${texto ? `: ${texto}` : ''}.`;
  }

  /** "Testar" da tela de tokens: pergunta ao Portal API o catálogo QUE ESTE TOKEN ENXERGA.
   * A lista já vem recortada pela autorização do token — é dela que sai o campo `consultas`,
   * sem ninguém digitar nome de consulta. */
  async sondar(
    url: string,
    chave: string,
  ): Promise<{ ok: boolean; mensagem: string; consultas: string[] }> {
    const base = (url || '').trim().replace(/\/+$/, '');
    if (!base || !chave.trim()) {
      return {
        ok: false,
        mensagem: 'Informe o endereço do Portal API e o token.',
        consultas: [],
      };
    }
    try {
      const res = await firstValueFrom(
        this.http.get<{ data?: { consultas?: { nome: string }[] } }>(
          `${base}/api/dados/v1/consultas`,
          { headers: { 'X-API-Key': chave.trim() }, timeout: TIMEOUT_MS },
        ),
      );
      const consultas = (res.data?.data?.consultas ?? []).map((c) => c.nome);
      return {
        ok: true,
        mensagem: consultas.length
          ? `Token válido — autoriza ${consultas.length} consulta(s).`
          : 'Token válido, mas não autoriza consulta nenhuma. Marque as consultas dele no Portal API.',
        consultas,
      };
    } catch (e) {
      return {
        ok: false,
        mensagem: this.mensagemDaFalha(e, {
          nome: 'informado',
          url: base,
        } as TokenApiDados),
        consultas: [],
      };
    }
  }
}
