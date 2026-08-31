import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CATALOGO, TAMANHO_PAGINA_MAX } from './catalogo/catalogo';
import { CatalogoService } from './catalogo/catalogo.service';
import { ChaveConexao, ParametroConsulta } from './catalogo/catalogo.types';
import { ehLeitura, extrairBinds } from './catalogo/binds.util';
import { ConsultaBD } from '../database/entities/consulta-bd.entity';
import { ConsultaBdService } from './consulta-bd.service';
import { ConexoesService } from './conexoes/conexoes.service';

/** Teto ABSOLUTO que uma consulta criada pela tela pode declarar. As de código chegam a
 * 20.000 porque cada uma foi dimensionada e revisada; uma consulta publicada sem revisão
 * não deve poder pedir isso. */
export const TETO_MAXIMO_DE_TELA = TAMANHO_PAGINA_MAX;

/** Padrão do nome público: `<origem>.<assunto>.<ação>`. É endereço de contrato — precisa ser
 * previsível para quem consome de fora. */
const RE_NOME_API = /^[a-z_]+(\.[a-z0-9-]+){2}$/;

const TIPOS_VALIDOS: ParametroConsulta['tipo'][] = [
  'data',
  'competencia',
  'datahora_minuto',
  'inteiro',
  'texto',
  'texto_busca',
  'lista_texto',
];

export interface AnaliseConsulta {
  ok: boolean;
  mensagem: string;
  /** Binds que o SQL cita, na ordem — viram a lista de parâmetros na tela. */
  binds: string[];
  /** Colunas devolvidas, descobertas executando com limite 1. */
  colunas: string[];
  /** Amostra de UMA linha, para o operador conferir que veio o que esperava. */
  amostra: Record<string, unknown> | null;
  ms: number;
}

/** Uma consulta salva como a TELA a enxerga — os campos de publicação já desempacotados. */
export interface ConsultaPublicadaResumo {
  slug: string;
  nome: string;
  conexao: ChaveConexao;
  sql: string;
  nomeApi: string;
  publicada: boolean;
  parametros: ParametroConsulta[];
  colunas: string[];
  limiteLinhas: number;
  cacheSegundos: number;
}

export interface SalvarConsultaPublicada {
  slug: string;
  nome: string;
  conexao: ChaveConexao;
  sql: string;
  nomeApi: string;
  /** O DTO chega com `descricao` opcional; o contrato do catálogo a quer sempre presente —
   * a normalização acontece ao gravar, não na borda. */
  parametros: (Omit<ParametroConsulta, 'descricao'> & { descricao?: string })[];
  colunas: string[];
  limiteLinhas: number;
  cacheSegundos: number;
  publicada: boolean;
}

/** Criação de consulta da API **pela TELA** — o caminho que dá autonomia para publicar sem
 * release (desenho das duas instâncias, 2026-08-25).
 *
 * O preço da autonomia é que o contrato não passa por PR nem por teste. Por isso as mesmas
 * checagens que o CI faz no catálogo de código rodam AQUI, na hora de salvar: só leitura,
 * bind × parâmetro casando exatamente, nome no padrão, teto presente e dentro do limite.
 * Não passou, não salva.
 *
 * O que este serviço NÃO consegue garantir é QUAL tabela o SELECT lê — isso é privilégio do
 * usuário no banco. É a razão de o usuário Oracle de privilégio mínimo ser pré-requisito
 * deste caminho, e não recomendação. */
@Injectable()
export class ConsultasPublicadasService {
  private readonly logger = new Logger('ConsultasPublicadasService');

  constructor(
    private readonly salvas: ConsultaBdService,
    private readonly conexoes: ConexoesService,
    private readonly catalogo: CatalogoService,
  ) {}

  /** As consultas salvas, com os campos de publicação já desempacotados — alimenta a lista
   * e o formulário da tela. */
  async listar(): Promise<ConsultaPublicadaResumo[]> {
    return (await this.salvas.listar()).map((l) => this.desempacotar(l));
  }

  async porSlug(slug: string): Promise<ConsultaPublicadaResumo | null> {
    const l = await this.salvas.porSlug(slug);
    return l ? this.desempacotar(l) : null;
  }

  private desempacotar(l: ConsultaBD): ConsultaPublicadaResumo {
    const json = <T>(texto: string | null, vazio: T): T => {
      if (!texto?.trim()) return vazio;
      try {
        return JSON.parse(texto) as T;
      } catch {
        return vazio;
      }
    };
    return {
      slug: l.slug,
      nome: l.nome,
      conexao: l.conexao === 'portal' ? 'portal_rech' : 'sicla',
      sql: l.sql,
      nomeApi: l.nomeApi ?? '',
      publicada: Boolean(l.publicada),
      parametros: json<ParametroConsulta[]>(l.parametros, []),
      colunas: json<string[]>(l.colunas, []),
      limiteLinhas: l.limiteLinhas ?? 0,
      cacheSegundos: l.cacheSegundos ?? 0,
    };
  }

  /** Roda o SQL com limite 1 para descobrir binds e colunas. É o "Testar" da tela: o
   * operador não digita a lista de campos — ela vem do próprio banco. */
  async analisar(
    conexao: ChaveConexao,
    sql: string,
    exemplos: Record<string, unknown> = {},
  ): Promise<AnaliseConsulta> {
    const vazio = (mensagem: string): AnaliseConsulta => ({
      ok: false,
      mensagem,
      binds: [],
      colunas: [],
      amostra: null,
      ms: 0,
    });
    if (!(sql || '').trim()) return vazio('Cole o SELECT antes de testar.');
    if (!ehLeitura(sql)) {
      return vazio('Só SELECT (ou WITH … SELECT) pode virar consulta da API.');
    }

    const binds = extrairBinds(sql);
    // Cada bind precisa de um valor para o teste rodar; o que falta vai como texto vazio,
    // que é o suficiente para o banco devolver o formato das colunas.
    const valores: Record<string, string | number | null> = {};
    let sqlTeste = sql;
    for (const b of binds) {
      const v = exemplos[b];
      if (Array.isArray(v)) {
        // Lista vira `(NULL)` no teste — mesma regra do executor com lista vazia.
        sqlTeste = sqlTeste.replace(
          new RegExp(`:${b}(?![A-Za-z0-9_])`, 'g'),
          '(NULL)',
        );
        continue;
      }
      // Só string/número viram valor de exemplo: um objeto viraria "[object Object]" e o
      // teste passaria com um bind silenciosamente errado.
      valores[b] =
        typeof v === 'string' || typeof v === 'number' ? String(v) : '';
    }

    const inicio = Date.now();
    const r = await this.conexoes.executar(conexao, sqlTeste, valores, 1);
    const ms = Date.now() - inicio;
    if (!r.ok) return { ...vazio(r.mensagem), binds, ms };

    return {
      ok: true,
      mensagem: `${r.colunas.length} coluna(s) em ${ms} ms.`,
      binds,
      colunas: r.colunas,
      amostra: r.linhas[0] ?? null,
      ms,
    };
  }

  /** Valida e grava. Devolve o slug salvo. */
  async salvar(dados: SalvarConsultaPublicada): Promise<string> {
    const sql = (dados.sql || '').trim();
    const erros: string[] = [];

    if (!sql) erros.push('Informe o SELECT.');
    else if (!ehLeitura(sql)) {
      erros.push('Só SELECT (ou WITH … SELECT) pode virar consulta da API.');
    }

    if (dados.publicada) {
      erros.push(...this.validarPublicacao(dados, sql));
    }
    if (erros.length) throw new BadRequestException(erros);

    const salvo = await this.salvas.salvar(dados.slug, {
      nome: dados.nome,
      sql,
      conexao: dados.conexao === 'portal_rech' ? 'portal' : 'sicla',
      nomeApi: dados.nomeApi.trim(),
      publicada: dados.publicada,
      parametros: JSON.stringify(
        (dados.parametros ?? []).map((p) => ({
          ...p,
          descricao: p.descricao ?? '',
        })),
      ),
      colunas: JSON.stringify(dados.colunas ?? []),
      limiteLinhas: dados.limiteLinhas,
      cacheSegundos: Math.max(0, dados.cacheSegundos || 0),
    });
    if (!salvo)
      throw new BadRequestException('Informe um identificador válido.');

    this.catalogo.invalidar();
    this.logger.log(
      `Consulta ${dados.publicada ? 'PUBLICADA' : 'salva'} pela tela: ${salvo.slug}` +
        (dados.publicada ? ` → ${dados.nomeApi}` : ''),
    );
    return salvo.slug;
  }

  /** As checagens que o CI faz no catálogo de código, aplicadas na hora de salvar. */
  private validarPublicacao(
    dados: SalvarConsultaPublicada,
    sql: string,
  ): string[] {
    const erros: string[] = [];
    const nomeApi = (dados.nomeApi || '').trim();

    if (!RE_NOME_API.test(nomeApi)) {
      erros.push(
        `"${nomeApi}" não é um nome válido. Use <origem>.<assunto>.<ação> — ex.: sicla.rns.por-cliente.`,
      );
    }
    if (CATALOGO.some((c) => c.nome === nomeApi)) {
      erros.push(
        `"${nomeApi}" já é uma consulta do catálogo em código e não pode ser sobrescrita pela tela.`,
      );
    }
    if (!dados.limiteLinhas || dados.limiteLinhas <= 0) {
      erros.push(
        'Informe o teto de linhas — publicar sem teto não é permitido.',
      );
    } else if (dados.limiteLinhas > TETO_MAXIMO_DE_TELA) {
      erros.push(
        `O teto de linhas de uma consulta criada pela tela vai até ${TETO_MAXIMO_DE_TELA}.`,
      );
    }

    // Bind × parâmetro: exatamente os mesmos, nos dois sentidos. Sobrando, o driver recusa
    // a execução (ORA-01036); faltando, recusa também (ORA-01008).
    const noSql = extrairBinds(sql);
    const declarados = (dados.parametros ?? []).map((p) =>
      (p.nome || '').trim(),
    );
    const faltando = noSql.filter((b) => !declarados.includes(b));
    const sobrando = declarados.filter((d) => !noSql.includes(d));
    if (faltando.length) {
      erros.push(
        `O SQL usa :${faltando.join(', :')} — declare o tipo de cada um.`,
      );
    }
    if (sobrando.length) {
      erros.push(
        `Parâmetro declarado que o SQL não usa: ${sobrando.join(', ')}.`,
      );
    }
    for (const p of dados.parametros ?? []) {
      if (!TIPOS_VALIDOS.includes(p.tipo)) {
        erros.push(`Tipo inválido em "${p.nome}": ${String(p.tipo)}.`);
      }
    }
    return erros;
  }

  async excluir(slug: string): Promise<boolean> {
    const ok = await this.salvas.excluir(slug);
    if (ok) this.catalogo.invalidar();
    return ok;
  }
}
