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

/** O formato que o Portal API emite: `rd_<12 hex>_<48 hex>`. Conferir ANTES de enviar é o
 * que separa "token errado" de "token incompleto" — os dois voltariam 401 do outro lado, com
 * a mesma cara, e foi assim que uma cópia truncada virou "seu token foi revogado" (achado
 * real em 2026-08-26). */
const RE_TOKEN = /^rd_[0-9a-f]{12}_[0-9a-f]{48}$/;

/** Diz o que está errado no texto colado, ou `null` se ele tem a cara de um token. */
export function problemaNoToken(bruto: string): string | null {
  const chave = (bruto || '').trim();
  if (!chave) return 'Cole o token gerado no Portal API.';
  if (RE_TOKEN.test(chave)) return null;

  if (/\s/.test(chave)) {
    return 'O token colado tem espaço ou quebra de linha. Ele é uma linha só — copie apenas o valor do campo Token.';
  }
  if (!chave.startsWith('rd_')) {
    return 'O token do Portal API começa com "rd_". O que foi colado não parece ser o token.';
  }
  const partes = chave.split('_');
  if (partes.length !== 3) {
    return 'O token tem três partes separadas por "_" (rd_prefixo_segredo). O que foi colado não tem.';
  }
  const [, prefixo, segredo] = partes;
  if (prefixo.length !== 12 || segredo.length !== 48) {
    return (
      `O token parece INCOMPLETO: o prefixo tem ${prefixo.length} caracteres (esperado 12) e o ` +
      `segredo, ${segredo.length} (esperado 48). Copie-o inteiro — no Portal API há um botão ` +
      '"Copiar", que evita seleção parcial.'
    );
  }
  return 'O token tem caracteres fora do esperado (só 0-9 e a-f depois de "rd_").';
}

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
      // NÃO afirmar a causa: daqui não dá para distinguir "revogado" de "copiado pela
      // metade" — os dois chegam como 401. Dizer "foi revogado" mandou o usuário procurar
      // no lugar errado (2026-08-26). O formato já foi conferido antes de enviar, então o
      // que sobra são estas três possibilidades, e elas vão declaradas.
      return (
        `O Portal API recusou o token "${token.nome}" (401). Nesta ordem de probabilidade: ` +
        'o token foi copiado incompleto; ele foi revogado ou rotacionado lá; ou o endereço ' +
        'aponta para outra instância, que não conhece este token.'
      );
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
    // Sem o `/api` e sem o `/config/...` do fim: colar a URL da barra de endereços do
    // navegador é o erro mais provável, e viraria um 404 incompreensível.
    const base = (url || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api(\/.*)?$/i, '')
      .replace(/\/config(\/.*)?$/i, '');
    if (!base) {
      return {
        ok: false,
        mensagem: 'Informe o endereço do Portal API.',
        consultas: [],
      };
    }
    // Formato conferido AQUI, antes de gastar uma ida à rede: um token truncado voltaria
    // 401 e pareceria revogado.
    const problema = problemaNoToken(chave);
    if (problema) return { ok: false, mensagem: problema, consultas: [] };
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
