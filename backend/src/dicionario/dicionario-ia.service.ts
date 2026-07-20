import { Injectable } from '@nestjs/common';
import { IaService } from '../ia/ia.service';
import { DicionarioService } from './dicionario.service';

const MAX_CHARS_POR_DOC = 12000;

const SISTEMA =
  'Você é um assistente técnico do ERP SIGER (Rech) para consultores de implantação e ' +
  'suporte. Responde em português do Brasil, SOMENTE com base nos TRECHOS DE DOCUMENTAÇÃO ' +
  'fornecidos. \n\n' +
  'REGRAS OBRIGATÓRIAS:\n' +
  '1. NUNCA invente menu, programa, tabela, parâmetro ou comportamento que não esteja nos ' +
  'trechos. É melhor dizer que não há informação suficiente do que supor.\n' +
  '2. Se os trechos não sustentam uma resposta segura, responda EXATAMENTE com: ' +
  '"Não foram encontradas informações suficientes nos documentos disponíveis para responder ' +
  'com segurança." e, se houver, aponte os assuntos mais próximos.\n' +
  '3. Quando houver base, organize a resposta com estas seções (omita as vazias): ' +
  'Resposta direta; Menu ou rotina; Objetivo; Pré-requisitos; Passo a passo; ' +
  'Parâmetros/campos; Dependências; Validação; Possíveis erros.\n' +
  '4. Cite os documentos usados pelo número [n] ao longo do texto, correspondendo à lista ' +
  'de fontes fornecida.\n' +
  '5. Seja objetivo e prático. Use os códigos exatos (ex.: CTB106, 1.6-T, CWREGEMP) como ' +
  'aparecem nos trechos.';

export interface FonteResposta {
  indice: number;
  slug: string;
  titulo: string;
  urlOrigem: string;
}

export interface RespostaDicionario {
  resposta: string;
  fontes: FonteResposta[];
  temFundamento: boolean;
  iaDisponivel: boolean;
}

@Injectable()
export class DicionarioIaService {
  constructor(
    private readonly ia: IaService,
    private readonly dicionario: DicionarioService,
  ) {}

  async perguntar(pergunta: string): Promise<RespostaDicionario> {
    const docs = await this.dicionario.recuperarParaPergunta(pergunta, 4);
    const fontes: FonteResposta[] = docs.map((d, i) => ({
      indice: i + 1,
      slug: d.slug,
      titulo: d.titulo,
      urlOrigem: d.urlOrigem,
    }));

    if (docs.length === 0) {
      return {
        resposta:
          'Não foram encontradas informações suficientes nos documentos disponíveis para ' +
          'responder com segurança.',
        fontes: [],
        temFundamento: false,
        iaDisponivel: this.ia.disponivel('dicionario'),
      };
    }

    // Sem chave de IA configurada: devolve os documentos relevantes (busca-guiada) em vez de
    // falhar — a tela mostra as fontes e o usuário abre os documentos manualmente.
    if (!this.ia.disponivel('dicionario')) {
      return {
        resposta:
          'A síntese por IA não está configurada (Config → IA). Foram encontrados documentos ' +
          'relacionados à sua pergunta — abra as fontes abaixo para os detalhes.',
        fontes,
        temFundamento: true,
        iaDisponivel: false,
      };
    }

    const contexto = docs
      .map((d, i) => {
        const corpo = d.conteudo.slice(0, MAX_CHARS_POR_DOC);
        return `[${i + 1}] ${d.titulo} (${d.sigla}) — fonte: ${d.slug}\n${corpo}`;
      })
      .join('\n\n---\n\n');

    const texto = (
      await this.ia.completar('dicionario', {
        system: SISTEMA,
        messages: [
          {
            role: 'user',
            content:
              `PERGUNTA: ${pergunta}\n\n` +
              `TRECHOS DE DOCUMENTAÇÃO (fontes numeradas):\n\n${contexto}`,
          },
        ],
        maxTokens: 2000,
      })
    ).trim();

    const semFundamento = texto.startsWith(
      'Não foram encontradas informações suficientes',
    );

    return {
      resposta: texto,
      fontes,
      temFundamento: !semFundamento,
      iaDisponivel: true,
    };
  }
}
