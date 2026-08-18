import { Injectable } from '@nestjs/common';
import { WalleArquivo } from '../database/entities/walle-arquivo.entity';
import { WalleEntidade } from '../database/entities/walle-entidade.entity';
import { WalleArquivosRepository } from './repositories/walle-arquivos.repository';
import { WalleChatsRepository } from './repositories/walle-chats.repository';
import { WalleEntidadesRepository } from './repositories/walle-entidades.repository';
import { normalizar, SINONIMOS } from './texto-walle.util';

/** Nível de confiança do resultado (§26): correspondência direta e forte = alta; relação
 * semântica/contextual = média; pouca evidência = baixa (nunca vira resposta principal). */
export type ConfiancaResultado = 'alta' | 'media' | 'baixa';

export interface ResultadoBusca {
  arquivoId: number;
  chat: number;
  chatDescricao: string;
  tecnico: string;
  sistema: string;
  titulo: string;
  resumo: string;
  categoria: string;
  origem: string;
  extensao: string;
  modificadoEm: Date | null;
  relevancia: number; // 0..100
  confianca: ConfiancaResultado;
  assuntos: string[];
  /** Como o resultado foi encontrado (rastreabilidade §27): termos/entidades que bateram. */
  evidencias: string[];
}

export interface SqlRelacionado {
  arquivoId: number;
  chat: number;
  objetivo: string;
  tabelas: string[];
  operacoes: string[];
}

export interface RespostaBusca {
  resumo: string;
  total: number;
  resultados: ResultadoBusca[];
  assuntosRelacionados: string[];
  tambemPodeSerUtil: Array<ResultadoBusca & { motivo: string }>;
  sqlsRelacionados: SqlRelacionado[];
  sugestoes: string[];
  /** Transparência da cobertura (§24): o que foi consultado nesta pesquisa. */
  cobertura: string;
}

export interface FiltrosBusca {
  q?: string;
  chat?: number;
  categoria?: string;
  origem?: string;
  assunto?: string;
  limite?: number;
}

// Pesos da pontuação lexical — correspondência direta SEMPRE domina a expandida (§8/§26).
const PESO = {
  entidadeExata: 8,
  titulo: 5,
  assunto: 4,
  resumo: 3,
  conteudo: 1,
  sinonimo: 0.5, // multiplicador sobre o peso do campo quando o termo veio de expansão
};
const LIMITE_PADRAO = 30;

interface DocIndexado {
  arquivo: WalleArquivo;
  tituloNorm: string;
  assuntosNorm: string;
  resumoNorm: string;
  conteudoNorm: string;
  entidades: WalleEntidade[];
  entidadesNorm: Set<string>;
}

/** Busca híbrida em memória sobre o índice do acervo Wall-e: identificadores exatos (RNS,
 * Ficha, tabela, erro) + lexical ponderada por campo + expansão por sinônimos do domínio.
 *
 * O acervo tem dezenas de documentos — carregar tudo e pontuar em memória é a decisão
 * certa aqui (mesmo racional do Dicionário Inteligente; o comentário de lá vale: "se o
 * acervo crescer uma ordem de grandeza, aí sim vale um índice fulltext/vetorial" — a
 * evolução para embeddings está registrada em docs/pendencias.md). */
@Injectable()
export class BuscaWalleService {
  constructor(
    private readonly arquivos: WalleArquivosRepository,
    private readonly chats: WalleChatsRepository,
    private readonly entidades: WalleEntidadesRepository,
  ) {}

  async pesquisar(filtros: FiltrosBusca): Promise<RespostaBusca> {
    const docs = await this.carregar();
    const chatsMeta = new Map(
      (await this.chats.todos()).map((c) => [c.codigo, c]),
    );
    const totalIndexado = docs.length;

    const filtrados = docs.filter((d) => {
      const a = d.arquivo;
      if (filtros.chat !== undefined && a.chatCodigo !== filtros.chat) return false;
      if (filtros.categoria && a.categoria !== filtros.categoria) return false;
      if (filtros.origem && a.origem !== filtros.origem) return false;
      if (filtros.assunto && !d.assuntosNorm.includes(normalizar(filtros.assunto))) {
        return false;
      }
      return true;
    });

    const q = (filtros.q ?? '').trim();
    const limite = filtros.limite ?? LIMITE_PADRAO;

    let pontuados: Array<{ doc: DocIndexado; pontos: number; evidencias: string[] }>;
    let indiretos: Array<{ doc: DocIndexado; pontos: number; evidencias: string[] }> = [];

    if (q === '') {
      // Sem pergunta: navegação — mais recentes primeiro, sem % de relevância inventado.
      pontuados = filtrados
        .sort(
          (a, b) =>
            (b.arquivo.modificadoEm?.getTime() ?? 0) -
            (a.arquivo.modificadoEm?.getTime() ?? 0),
        )
        .map((doc) => ({ doc, pontos: 0, evidencias: [] }));
    } else {
      const { diretos, expandidos } = this.termos(q);
      const avaliados = filtrados.map((doc) =>
        this.pontuar(doc, diretos, expandidos),
      );
      pontuados = avaliados
        .filter((r) => r.pontosDiretos > 0)
        .map(({ doc, pontos, evidencias }) => ({ doc, pontos, evidencias }))
        .sort((a, b) => b.pontos - a.pontos);
      // Só bateu por expansão semântica → não é resposta, é "também pode ser útil" (§16).
      indiretos = avaliados
        .filter((r) => r.pontosDiretos === 0 && r.pontos > 0)
        .map(({ doc, pontos, evidencias }) => ({ doc, pontos, evidencias }))
        .sort((a, b) => b.pontos - a.pontos);
    }

    const maxPontos = pontuados[0]?.pontos || 1;
    const resultados = pontuados.slice(0, limite).map((r) =>
      this.montarResultado(r.doc, chatsMeta, q === '' ? null : r.pontos / maxPontos, r.evidencias),
    );

    const tambemPodeSerUtil = [
      ...indiretos.slice(0, 5).map((r) => ({
        ...this.montarResultado(r.doc, chatsMeta, 0.2, r.evidencias),
        motivo: `Relação indireta: ${r.evidencias.join(', ')}.`,
      })),
      ...this.relacionadosPorEntidade(
        docs,
        pontuados.slice(0, 5).map((p) => p.doc),
        resultados.map((r) => r.arquivoId),
        chatsMeta,
      ),
    ].slice(0, 5);

    return {
      resumo: this.sintetizar(q, resultados, chatsMeta.size),
      total: resultados.length,
      resultados,
      assuntosRelacionados: this.assuntosRelacionados(
        pontuados.slice(0, 10).map((p) => p.doc),
        q,
      ),
      tambemPodeSerUtil,
      sqlsRelacionados: this.sqls(pontuados.map((p) => p.doc)),
      sugestoes: this.sugestoes(resultados),
      cobertura:
        `A pesquisa consultou o acervo documental indexado (${totalIndexado} arquivo(s) ` +
        `de ${chatsMeta.size} chat(s)). O acervo não representa todos os chats do Wall-e — ` +
        'a conversa completa vive no SICLA.',
    };
  }

  /** Pergunta → termos diretos + termos expandidos por sinônimo (peso menor). */
  private termos(q: string): { diretos: string[]; expandidos: string[] } {
    const diretos = [
      ...new Set(normalizar(q).split(/[^a-z0-9_-]+/).filter((t) => t.length > 1)),
    ];
    const expandidos = new Set<string>();
    for (const t of diretos) {
      for (const s of SINONIMOS[t] ?? []) {
        if (!diretos.includes(s)) expandidos.add(s);
      }
    }
    return { diretos, expandidos: [...expandidos] };
  }

  private pontuar(
    doc: DocIndexado,
    diretos: string[],
    expandidos: string[],
  ): { doc: DocIndexado; pontos: number; pontosDiretos: number; evidencias: string[] } {
    const evidencias: string[] = [];
    let pontosDiretos = 0;
    let pontosExpandidos = 0;

    const pontuaTermo = (termo: string, fator: number): number => {
      let p = 0;
      // Identificador exato (853, 563996-1, ORA-01400, FILA_WALLE) vale mais que texto.
      for (const ent of doc.entidadesNorm) {
        if (ent === termo || ent.includes(termo)) {
          p += PESO.entidadeExata * fator;
          if (fator === 1) evidencias.push(`entidade ${ent}`);
          break;
        }
      }
      if (doc.tituloNorm.includes(termo)) {
        p += PESO.titulo * fator;
        if (fator === 1) evidencias.push(`título contém "${termo}"`);
      }
      if (doc.assuntosNorm.includes(termo)) p += PESO.assunto * fator;
      if (doc.resumoNorm.includes(termo)) p += PESO.resumo * fator;
      const ocorrencias = doc.conteudoNorm.split(termo).length - 1;
      if (ocorrencias > 0) p += PESO.conteudo * Math.min(ocorrencias, 5) * fator;
      return p;
    };

    for (const t of diretos) pontosDiretos += pontuaTermo(t, 1);
    for (const t of expandidos) pontosExpandidos += pontuaTermo(t, PESO.sinonimo);
    if (pontosDiretos === 0 && pontosExpandidos > 0) {
      evidencias.push(`termos relacionados: ${expandidos.join(', ')}`);
    }

    return {
      doc,
      pontos: pontosDiretos + pontosExpandidos,
      pontosDiretos,
      evidencias: [...new Set(evidencias)].slice(0, 4),
    };
  }

  private montarResultado(
    doc: DocIndexado,
    chatsMeta: Map<number, { descricao: string; tecnico: string; sistema: string }>,
    proporcao: number | null,
    evidencias: string[],
  ): ResultadoBusca {
    const a = doc.arquivo;
    const meta = chatsMeta.get(a.chatCodigo);
    const relevancia = proporcao === null ? 0 : Math.round(proporcao * 100);
    return {
      arquivoId: a.id,
      chat: a.chatCodigo,
      chatDescricao: meta?.descricao ?? '',
      tecnico: meta?.tecnico ?? '',
      sistema: meta?.sistema ?? '',
      titulo: a.titulo,
      resumo: a.resumo,
      categoria: a.categoria,
      origem: a.origem,
      extensao: a.extensao,
      modificadoEm: a.modificadoEm,
      relevancia,
      confianca: relevancia >= 65 ? 'alta' : relevancia >= 35 ? 'media' : 'baixa',
      assuntos: a.assuntos === '' ? [] : a.assuntos.split(' '),
      evidencias,
    };
  }

  /** Chats/arquivos que compartilham entidade forte (RNS/ficha/tabela/repo) com os melhores
   * resultados, sem terem batido na pergunta — conhecimento indireto (§14/§16). */
  private relacionadosPorEntidade(
    todos: DocIndexado[],
    melhores: DocIndexado[],
    jaListados: number[],
    chatsMeta: Map<number, { descricao: string; tecnico: string; sistema: string }>,
  ): Array<ResultadoBusca & { motivo: string }> {
    if (melhores.length === 0) return [];
    const fortes = new Set<string>();
    for (const m of melhores) {
      for (const e of m.entidades) {
        if (['rns', 'ficha', 'tabela', 'repositorio', 'erro'].includes(e.tipo)) {
          fortes.add(`${e.tipo}:${e.valor}`);
        }
      }
    }
    const saida: Array<ResultadoBusca & { motivo: string }> = [];
    for (const doc of todos) {
      if (jaListados.includes(doc.arquivo.id)) continue;
      const comum = doc.entidades.find((e) => fortes.has(`${e.tipo}:${e.valor}`));
      if (!comum) continue;
      saida.push({
        ...this.montarResultado(doc, chatsMeta, 0.2, []),
        motivo:
          `Não trata diretamente do pesquisado, mas compartilha ` +
          `${rotuloTipo(comum.tipo)} ${comum.valor} com os resultados.`,
      });
      if (saida.length >= 3) break;
    }
    return saida;
  }

  private assuntosRelacionados(melhores: DocIndexado[], q: string): string[] {
    const qNorm = new Set(normalizar(q).split(/[^a-z0-9-]+/));
    const contagem = new Map<string, number>();
    for (const doc of melhores) {
      for (const a of doc.arquivo.assuntos.split(' ')) {
        if (a === '' || qNorm.has(a)) continue;
        contagem.set(a, (contagem.get(a) ?? 0) + 1);
      }
      for (const e of doc.entidades) {
        if (['tabela', 'repositorio', 'tecnologia'].includes(e.tipo)) {
          const chave = e.valor.toLowerCase();
          if (!qNorm.has(chave)) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
        }
      }
    }
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([assunto]) => assunto);
  }

  /** SQLs entre os resultados (§18): objetivo, tabelas e operações — conteúdo DOCUMENTAL,
   * a tela nunca oferece execução. */
  private sqls(docs: DocIndexado[]): SqlRelacionado[] {
    return docs
      .filter((d) => d.arquivo.categoria === 'sql')
      .slice(0, 5)
      .map((d) => ({
        arquivoId: d.arquivo.id,
        chat: d.arquivo.chatCodigo,
        objetivo: d.arquivo.titulo || d.arquivo.resumo,
        tabelas: d.entidades.filter((e) => e.tipo === 'tabela').map((e) => e.valor),
        operacoes: operacoesSql(d.arquivo.conteudo),
      }));
  }

  /** Síntese do topo da resposta (§9) — contagem honesta por confiança, e a frase EXATA
   * exigida pela §24 quando nada foi achado no acervo. */
  private sintetizar(
    q: string,
    resultados: ResultadoBusca[],
    totalChats: number,
  ): string {
    if (q === '') {
      return `Acervo com ${resultados.length} documento(s) de ${totalChats} chat(s), do mais recente para o mais antigo.`;
    }
    if (resultados.length === 0) {
      return 'Não foi localizado material relevante no acervo documental consultado.';
    }
    const alta = resultados.filter((r) => r.confianca === 'alta').length;
    const media = resultados.filter((r) => r.confianca === 'media').length;
    const chats = new Set(resultados.map((r) => r.chat)).size;
    const partes = [
      `${resultados.length} documento(s) relacionado(s) em ${chats} chat(s)`,
    ];
    if (alta > 0) partes.push(`${alta} com correspondência direta`);
    if (media > 0) partes.push(`${media} com relação contextual`);
    if (alta === 0) {
      partes.push(
        'nenhum com correspondência direta — trate os resultados como pistas, não como resposta',
      );
    }
    return `Foram encontrados ${partes.join('; ')}.`;
  }

  /** "Você também pode pesquisar" (§40) — derivado dos assuntos/entidades dos resultados. */
  private sugestoes(resultados: ResultadoBusca[]): string[] {
    const sugestoes: string[] = [];
    const vistos = new Set<string>();
    for (const r of resultados.slice(0, 3)) {
      for (const a of r.assuntos.slice(0, 3)) {
        if (vistos.has(a)) continue;
        vistos.add(a);
        sugestoes.push(`O que já foi analisado sobre ${a}?`);
        if (sugestoes.length >= 5) return sugestoes;
      }
    }
    return sugestoes;
  }

  private async carregar(): Promise<DocIndexado[]> {
    const [arquivos, entidades] = await Promise.all([
      this.arquivos.ativos(),
      this.entidades.todas(),
    ]);
    const porArquivo = new Map<number, WalleEntidade[]>();
    for (const e of entidades) {
      const lista = porArquivo.get(e.arquivoId) ?? [];
      lista.push(e);
      porArquivo.set(e.arquivoId, lista);
    }
    return arquivos.map((arquivo) => {
      const ents = porArquivo.get(arquivo.id) ?? [];
      return {
        arquivo,
        tituloNorm: normalizar(arquivo.titulo),
        assuntosNorm: normalizar(arquivo.assuntos),
        resumoNorm: normalizar(arquivo.resumo),
        conteudoNorm: normalizar(arquivo.conteudo),
        entidades: ents,
        entidadesNorm: new Set(ents.map((e) => normalizar(e.valor))),
      };
    });
  }
}

function rotuloTipo(tipo: string): string {
  const rotulos: Record<string, string> = {
    rns: 'a RNS',
    ficha: 'a Ficha',
    tabela: 'a tabela',
    repositorio: 'o repositório',
    erro: 'o erro',
  };
  return rotulos[tipo] ?? 'a entidade';
}

function operacoesSql(sql: string): string[] {
  const norm = sql.toUpperCase();
  return ['SELECT', 'UPDATE', 'INSERT', 'DELETE', 'MERGE', 'COMMIT', 'ROLLBACK'].filter(
    (op) => new RegExp(`\\b${op}\\b`).test(norm),
  );
}
