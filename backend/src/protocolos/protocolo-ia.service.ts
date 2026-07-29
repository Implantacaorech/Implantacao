import { Injectable } from '@nestjs/common';
import { IaService } from '../ia/ia.service';
import { PROTO_CAMPOS_TEXTO, PROTO_MODULOS } from './protocolos.constants';

const SISTEMA =
  'Você é um consultor especialista em documentação de treinamentos de sistemas ERP. ' +
  'Analise INTEGRALMENTE a transcrição da gravação de um treinamento do ERP SIGER (Rech) ' +
  'e produza um PROTOCOLO TÉCNICO em português do Brasil, considerando somente os ' +
  'assuntos relacionados ao treinamento realizado. O resultado deve permitir que outro ' +
  'consultor entenda exatamente o conteúdo abordado sem assistir à gravação de novo.\n\n' +
  'REGRAS GERAIS:\n' +
  '1. NUNCA invente informação — use apenas o que está realmente na transcrição.\n' +
  "2. Se faltar detalhe, escreva exatamente: 'Informação não detalhada no vídeo'.\n" +
  '3. Organize o conteúdo de forma clara e, sempre que possível, cronológica (na ordem ' +
  'em que o treinamento aconteceu).\n' +
  '4. Linguagem técnica, objetiva e profissional. Destaque nomes de menus, ' +
  'funcionalidades, processos e conceitos para facilitar consultas futuras.\n' +
  '5. Quando útil, referencie o tempo da gravação entre colchetes, ex.: [12:35].\n\n' +
  'FILTRAGEM (remova completamente da versão final):\n' +
  'conversas paralelas · cumprimentos, despedidas e assuntos pessoais · piadas e ' +
  'comentários informais · conversas comerciais · discussões sobre outros clientes · ' +
  'assuntos administrativos · problemas de infraestrutura (internet, computador, áudio), ' +
  'EXCETO quando impactarem diretamente o treinamento · interrupções, pausas e tempo de ' +
  "espera · repetições. Liste resumidamente o que foi removido em 'assuntos_removidos' " +
  '(auditoria).\n\n' +
  'CLASSIFICAÇÃO:\n' +
  `- 'modulo': UM destes: ${PROTO_MODULOS.map((m) => `'${m}'`).join(', ')}. ` +
  "Sem evidência clara -> 'Módulo a validar'.\n" +
  "- 'menu': o menu PRINCIPAL do SIGER tratado (ex.: '1.4-I', '3.4-L', 'Menu 4'). " +
  "Sem certeza -> 'Menu não identificado - revisar manualmente'. Os demais menus vão " +
  "em 'menus_abordados'.\n\n" +
  'CONTEÚDO DE CADA CAMPO:\n' +
  "- 'titulo': título do protocolo. 'assunto': o assunto central em uma linha.\n" +
  "- 'resumo' (Resumo Geral): resumo executivo com objetivo do treinamento, principais " +
  'atividades executadas, resultado obtido e observações relevantes.\n' +
  "- 'objetivo': objetivo da rotina/treinamento. 'quando_utilizar': em que situação a " +
  "rotina se aplica. 'pre_requisitos': o que precisa existir antes.\n" +
  "- 'menus_abordados' (Menus do Sistema Abordados): TODOS os menus citados no " +
  'treinamento, um bloco por menu, no formato:\n' +
  '  ### <menu> — <nome do menu>\n' +
  '  Objetivo: <para que serve>\n' +
  '  Atividades realizadas:\n' +
  '  - <inclusão, alteração, consulta, filtros, impressão, geração de documentos, ' +
  'validações, parametrizações, importações, exportações...>\n' +
  '  Passo a passo: (1., 2., ... — só quando houver sequência operacional demonstrada)\n' +
  "- 'funcionalidades' (Funcionalidades Demonstradas): um bloco por funcionalidade, com " +
  'nome, finalidade, como foi utilizada e observações importantes.\n' +
  "- 'passo_a_passo': a sequência operacional consolidada do treinamento, numerada " +
  '(1., 2., ...), prática, na ordem executada.\n' +
  "- 'processos' (Processos Executados): processos rodados no treinamento (cadastro, " +
  'faturamento, compras, estoque, produção, financeiro, importações, emissão de ' +
  'documentos, integração entre módulos...), cada um com explicação resumida.\n' +
  "- 'definicoes' (Definições): conceitos e termos explicados pelo consultor — " +
  'funcionamento do sistema, boas práticas, diferenças entre opções, restrições. ' +
  "Formato '- <Termo>: <explicação clara e objetiva>'.\n" +
  "- 'regras_negocio': regras, validações e restrições do sistema/processo.\n" +
  "- 'configuracoes' (Configurações e Parametrizações): parâmetros alterados, " +
  'configurações realizadas, impacto e motivo de cada alteração.\n' +
  "- 'dependencias': o que depende de outra rotina/módulo/terceiro. " +
  "'pontos_atencao': cuidados e riscos citados. 'exemplos': exemplos concretos usados.\n" +
  "- 'duvidas' (Dúvidas Respondidas): perguntas do participante e a resposta dada, no " +
  "formato '- P: <pergunta>' seguido de '  R: <resposta>'. Sem perguntas -> vazio.\n" +
  "- 'pendencias_treinamento' (Pendências): o que ficou pendente com o cliente " +
  '(ajustes, parametrizações, cadastros, testes, validações, retornos futuros). ' +
  "Se não houver, escreva exatamente 'Nenhuma pendência identificada.'.\n" +
  "- 'proximos_passos': ações futuras mencionadas no treinamento.\n" +
  "- 'resumo_tecnico' (Resumo Técnico Final): tópicos curtos só com os pontos mais " +
  'importantes.\n' +
  "- 'pendencias': o que precisa de REVISÃO HUMANA nesta documentação (menu/módulo " +
  'ambíguo, configuração citada mas não demonstrada, trecho inaudível...) — é a lista ' +
  'do revisor, não do cliente.\n\n' +
  'FORMATO DAS LISTAS: um item por linha, prefixado com "- " (em menus_abordados e ' +
  'funcionalidades use os blocos descritos acima).\n\n' +
  'Responda APENAS com um objeto JSON (sem texto antes/depois) com EXATAMENTE estas ' +
  'chaves, todas strings: titulo, modulo, menu, assunto, resumo, objetivo, ' +
  'quando_utilizar, pre_requisitos, menus_abordados, funcionalidades, passo_a_passo, ' +
  'processos, definicoes, regras_negocio, configuracoes, dependencias, pontos_atencao, ' +
  'exemplos, duvidas, pendencias_treinamento, proximos_passos, resumo_tecnico, ' +
  'assuntos_removidos, pendencias.';

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
  menusAbordados: 'menus_abordados',
  funcionalidades: 'funcionalidades',
  passoAPasso: 'passo_a_passo',
  processos: 'processos',
  definicoes: 'definicoes',
  regrasNegocio: 'regras_negocio',
  configuracoes: 'configuracoes',
  dependencias: 'dependencias',
  pontosAtencao: 'pontos_atencao',
  exemplos: 'exemplos',
  duvidas: 'duvidas',
  pendenciasTreinamento: 'pendencias_treinamento',
  proximosPassos: 'proximos_passos',
  resumoTecnico: 'resumo_tecnico',
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
 * revisar manualmente'. O prompt segue as 10 seções obrigatórias do protocolo de
 * treinamento (resumo geral, menus abordados, funcionalidades, definições,
 * configurações, processos, dúvidas, pendências, próximos passos, resumo técnico) —
 * homologado fora do painel antes de entrar aqui (2026-07-29). Já não espelha
 * webapp/protocolo_ia.py (o legado ficou na estrutura antiga). */
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
    if (!campos.pendenciasTreinamento) {
      // Regra da seção 8 do prompt: ausência de pendências é declarada, não fica em branco.
      campos.pendenciasTreinamento = 'Nenhuma pendência identificada.';
    }
    return { campos, bruto };
  }
}
