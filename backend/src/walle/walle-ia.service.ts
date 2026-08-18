import { Injectable } from '@nestjs/common';
import { IaService } from '../ia/ia.service';
import { BuscaWalleService, RespostaBusca } from './busca-walle.service';
import { WalleArquivosRepository } from './repositories/walle-arquivos.repository';

const MAX_CHARS_POR_DOC = 12000;
const MAX_DOCS_CONTEXTO = 4;

// A frase de recusa é CONTRATO (§28 da especificação): a tela a reconhece e o teste cobra.
export const SEM_EVIDENCIA =
  'Não foi localizada evidência suficiente nas fontes consultadas.';

const SISTEMA =
  'Você é o assistente de consulta ao acervo de conhecimento do Wall-e (bot interno da ' +
  'Rech, técnico 900 do SICLA). Responde em português do Brasil, SOMENTE com base nos ' +
  'TRECHOS DE DOCUMENTOS fornecidos — análises, SQLs e investigações produzidas em chats ' +
  'anteriores.\n\n' +
  'REGRAS OBRIGATÓRIAS:\n' +
  '1. NUNCA invente chat, arquivo, técnico, RNS, Ficha, sistema, repositório, SQL, solução ' +
  'ou conclusão que não esteja nos trechos. É melhor dizer que não há evidência do que supor.\n' +
  `2. Se os trechos não sustentam uma resposta segura, responda EXATAMENTE com: "${SEM_EVIDENCIA}" ` +
  'e, se houver, aponte os assuntos mais próximos encontrados.\n' +
  '3. Quando houver base, organize a resposta com estas seções (omita as vazias): ' +
  'Resposta direta; O que já foi analisado; Problema; Causa; Solução encontrada; ' +
  'Componentes envolvidos; Onde está a evidência.\n' +
  '4. Cite os documentos usados pelo número [n] ao longo do texto, correspondendo à lista ' +
  'de fontes fornecida.\n' +
  '5. Use os identificadores exatos como aparecem nos trechos (ex.: RNS 563996-1, Ficha ' +
  '324397, FILA_WALLE, ri-wall-e).';

export interface FonteRespostaWalle {
  indice: number;
  arquivoId: number;
  chat: number;
  titulo: string;
  caminhoRelativo: string;
}

export interface RespostaWalleIa {
  resposta: string;
  fontes: FonteRespostaWalle[];
  temFundamento: boolean;
  iaDisponivel: boolean;
  busca: RespostaBusca;
}

/** Síntese em linguagem natural sobre o acervo (RAG) — finalidade `walle`, que é SÓ-LOCAL
 * por política (§21-A.10: o acervo cita clientes e dados de produção; o texto não sai da
 * rede). Sem provedor configurado, degrada para busca-guiada: devolve os documentos
 * relevantes e a tela os apresenta como fontes (mesmo desenho do Dicionário Inteligente). */
@Injectable()
export class WalleIaService {
  constructor(
    private readonly ia: IaService,
    private readonly busca: BuscaWalleService,
    private readonly arquivos: WalleArquivosRepository,
  ) {}

  async perguntar(pergunta: string, solicitante?: string): Promise<RespostaWalleIa> {
    const busca = await this.busca.pesquisar({ q: pergunta });
    const melhores = busca.resultados.slice(0, MAX_DOCS_CONTEXTO);
    const docs = (
      await Promise.all(melhores.map((r) => this.arquivos.porId(r.arquivoId)))
    ).filter((d): d is NonNullable<typeof d> => d !== null && d.conteudo !== '');

    const fontes: FonteRespostaWalle[] = docs.map((d, i) => ({
      indice: i + 1,
      arquivoId: d.id,
      chat: d.chatCodigo,
      titulo: d.titulo,
      caminhoRelativo: d.caminhoRelativo,
    }));

    if (docs.length === 0) {
      return {
        resposta: SEM_EVIDENCIA,
        fontes: [],
        temFundamento: false,
        iaDisponivel: this.ia.disponivel('walle'),
        busca,
      };
    }

    if (!this.ia.disponivel('walle')) {
      return {
        resposta:
          'A síntese por IA não está configurada para o Wall-e (Config → IA — provedor ' +
          'LOCAL, por política de privacidade). Foram encontrados documentos relacionados ' +
          'à sua pergunta — abra as fontes abaixo para os detalhes.',
        fontes,
        temFundamento: true,
        iaDisponivel: false,
        busca,
      };
    }

    const contexto = docs
      .map((d, i) => {
        const corpo = d.conteudo.slice(0, MAX_CHARS_POR_DOC);
        return `[${i + 1}] ${d.titulo} (chat ${d.chatCodigo}, ${d.caminhoRelativo})\n${corpo}`;
      })
      .join('\n\n---\n\n');

    const texto = (
      await this.ia.completar(
        'walle',
        {
          system: SISTEMA,
          messages: [
            {
              role: 'user',
              content:
                `PERGUNTA: ${pergunta}\n\n` +
                `TRECHOS DE DOCUMENTOS DO ACERVO (fontes numeradas):\n\n${contexto}`,
            },
          ],
          maxTokens: 2000,
        },
        { solicitante, contexto: 'consulta wall-e' },
      )
    ).trim();

    return {
      resposta: texto,
      fontes,
      temFundamento: !texto.startsWith(SEM_EVIDENCIA),
      iaDisponivel: true,
      busca,
    };
  }
}
