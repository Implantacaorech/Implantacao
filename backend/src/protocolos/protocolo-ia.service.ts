import { Injectable } from '@nestjs/common';
import { IaService } from '../ia/ia.service';
import { PROTO_CAMPOS_TEXTO, PROTO_MODULOS } from './protocolos.constants';

const SISTEMA =
  'Você transforma a TRANSCRIÇÃO de um vídeo de treinamento do ERP SIGER (Rech) em um ' +
  'REGISTRO DE PROTOCOLO estruturado, em português do Brasil.\n\n' +
  'REGRAS OBRIGATÓRIAS:\n' +
  '1. NUNCA invente informação que não esteja na transcrição.\n' +
  "2. Se faltar detalhe, escreva exatamente: 'Informação não detalhada no vídeo'.\n" +
  `3. 'modulo' deve ser UM destes: ${PROTO_MODULOS.map((m) => `'${m}'`).join(', ')}. ` +
  "Sem evidência clara -> 'Módulo a validar'.\n" +
  "4. 'menu' = o menu do SIGER citado (ex.: '1.4-I', '2.6-R', 'Cadastro de Produtos'). " +
  "Sem certeza -> 'Menu não identificado - revisar manualmente'.\n" +
  '5. REMOVA da versão final: conversas paralelas, comentários pessoais, dúvidas sem ' +
  'relação, assuntos de passagem, problemas técnicos alheios, interrupções e repetições. ' +
  "Liste resumidamente o que foi removido em 'assuntos_removidos' (auditoria).\n" +
  "6. Em 'pendencias', liste o que precisa de revisão humana (menu/módulo ambíguo, " +
  'configuração citada mas não demonstrada, trecho inaudível...).\n' +
  "7. 'passo_a_passo' numerado (1., 2., ...), prático, na ordem executada no vídeo.\n" +
  '8. Quando útil, referencie o tempo do vídeo entre colchetes, ex.: [12:35].\n' +
  '9. Listas (pre_requisitos, configuracoes, dependencias, regras_negocio, ' +
  'pontos_atencao, exemplos, assuntos_removidos, pendencias): um item por linha, ' +
  "prefixado com '- '.\n\n" +
  'Responda APENAS com um objeto JSON (sem texto antes/depois) com EXATAMENTE estas ' +
  'chaves, todas strings: titulo, modulo, menu, assunto, resumo, objetivo, ' +
  'quando_utilizar, pre_requisitos, passo_a_passo, configuracoes, dependencias, ' +
  'regras_negocio, pontos_atencao, exemplos, assuntos_removidos, pendencias.';

// camelCase (entidade) -> snake_case (chave que a IA devolve, igual ao prompt/ao Flask).
const CHAVE_IA: Record<string, string> = {
  titulo: 'titulo',
  modulo: 'modulo',
  menu: 'menu',
  assunto: 'assunto',
  resumo: 'resumo',
  objetivo: 'objetivo',
  quandoUtilizar: 'quando_utilizar',
  preRequisitos: 'pre_requisitos',
  passoAPasso: 'passo_a_passo',
  configuracoes: 'configuracoes',
  dependencias: 'dependencias',
  regrasNegocio: 'regras_negocio',
  pontosAtencao: 'pontos_atencao',
  exemplos: 'exemplos',
  assuntosRemovidos: 'assuntos_removidos',
  pendencias: 'pendencias',
};

export interface ResultadoAnaliseIa {
  campos: Partial<Record<(typeof PROTO_CAMPOS_TEXTO)[number], string>>;
  bruto: string;
}

function extraiJson(txt: string): unknown {
  try {
    return JSON.parse(txt);
  } catch {
    const m = /\{[\s\S]*\}/.exec(txt || '');
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Análise IA da transcrição -> registro de protocolo estruturado. Usa a mesma chave/
 * config de IA do painel (`IaService` — Config → IA). Regras duras: NUNCA inventar;
 * módulo sem evidência = 'Módulo a validar'; menu incerto = 'Menu não identificado -
 * revisar manualmente'. Espelha webapp/protocolo_ia.py. */
@Injectable()
export class ProtocoloIaService {
  constructor(private readonly ia: IaService) {}

  disponivel(): boolean {
    return this.ia.disponivel('protocolos');
  }

  async analisar(
    transcricao: string,
    videoNome = '',
  ): Promise<ResultadoAnaliseIa> {
    const user = `Vídeo: ${videoNome}\n\nTRANSCRIÇÃO (com timestamps):\n${transcricao}`;
    const bruto = await this.ia.completar('protocolos', {
      system: SISTEMA,
      messages: [{ role: 'user', content: user }],
      maxTokens: 8000,
    });
    const data = extraiJson(bruto);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error('A IA não devolveu o JSON esperado.');
    }
    const bruto_data = data as Record<string, unknown>;
    const campos: ResultadoAnaliseIa['campos'] = {};
    for (const campo of PROTO_CAMPOS_TEXTO) {
      const chave = CHAVE_IA[campo];
      const valor = bruto_data[chave];
      campos[campo] = (typeof valor === 'string' ? valor : '').trim();
    }
    if (
      !PROTO_MODULOS.includes(campos.modulo as (typeof PROTO_MODULOS)[number])
    ) {
      campos.modulo = 'Módulo a validar';
    }
    if (!campos.menu) {
      campos.menu = 'Menu não identificado - revisar manualmente';
    }
    if (!campos.titulo) {
      campos.titulo = `Protocolo de treinamento — ${videoNome || 'vídeo'}`;
    }
    return { campos, bruto };
  }
}
