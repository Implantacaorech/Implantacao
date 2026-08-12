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

/** 2ª chamada de IA: resumo COMPLETO da transcrição em texto corrido/estruturado — é o
 * que a tela de revisão mostra no lugar da leitura da transcrição bruta. Roda separado da
 * análise de propósito: o JSON da análise já consome quase todo o orçamento de tokens de
 * saída, e um campo longo dentro dele sairia truncado (JSON inválido). */
const SISTEMA_RESUMO =
  'Você é um consultor especialista em documentação de treinamentos do ERP SIGER (Rech). ' +
  'Leia INTEGRALMENTE a transcrição de uma gravação de treinamento e escreva o REGISTRO ' +
  'COMPLETO do que foi feito, em português do Brasil — o texto deve cobrir TODA a ' +
  'transcrição, do começo ao fim, sem pular assunto técnico.\n\n' +
  'REGRAS:\n' +
  '1. NUNCA invente informação — use apenas o que está na transcrição.\n' +
  "2. Se faltar detalhe, escreva exatamente: 'Informação não detalhada no vídeo'.\n" +
  '3. Descarte conversa paralela, cumprimentos, assuntos pessoais/comerciais, ' +
  'interrupções e repetições. Só conteúdo técnico do treinamento.\n' +
  '4. Linguagem técnica, objetiva, impessoal (sem "o consultor mostrou..."). Destaque ' +
  'nomes de menus, teclas de atalho, rotinas e conceitos.\n' +
  '5. Ordem cronológica do treinamento.\n' +
  '6. Responda SOMENTE com o texto do registro — sem JSON, sem markdown, sem comentários ' +
  'antes ou depois.\n\n' +
  'TÍTULO DE CADA BLOCO — é o erro mais comum, leia com atenção:\n' +
  '- Cada bloco é um MENU ou uma ROTINA do SIGER.\n' +
  '- CÓDIGO DE MENU: só escreva um se ele estiver na lista MENUS DO SIGER RECONHECIDOS ' +
  'entregue no pedido, ou se aparecer LITERALMENTE na transcrição. Nesse caso use o código ' +
  'exatamente como veio (ex.: "Menu 3.4-L – Listagem de Caixa:").\n' +
  '- ⚠️ Se não houver lista e o código não estiver dito na gravação, **NÃO INVENTE UM**. ' +
  'Escrever "Menu 3.4" por dedução é pior do que não citar menu nenhum: quem revisa confia ' +
  'no código e vai procurar uma tela que não existe. Nesse caso, titule o bloco pelo NOME ' +
  'PRÓPRIO da rotina ou da tela como ela foi chamada na gravação (ex.: "Geração de ' +
  'Necessidades Materiais:", "Rotina de Conciliação Bancária:").\n' +
  '- É PROIBIDO usar como título um assunto genérico em caixa alta ("PARAMETRIZAÇÕES E ' +
  'CONFIGURAÇÕES:", "HISTÓRICO DE DEMANDA:", "BLOCOS DE JANELA:"). Isso não é nem menu nem ' +
  'rotina — é um tema inventado para agrupar parágrafos.\n' +
  '- Um bloco por TELA/ROTINA. Não empilhe vários pares Ação/Finalidade sob o mesmo ' +
  'título: se a gravação passou por cinco telas, são cinco blocos.\n\n' +
  'LINHAS DE CADA BLOCO: use TODOS os rótulos que couberem ao caso, não só dois. ' +
  '`Ação:` e `Finalidade:` são o mínimo; acrescente `Configuração:`, `Parâmetros:`, ' +
  '`Recurso:`, `Processamento:`, `Automação:`, `Correção:` e `Validação:` sempre que a ' +
  'gravação tiver esse conteúdo. Um bloco só com Ação/Finalidade num trecho que mostrou ' +
  'parametrização é registro incompleto.\n\n' +
  'DEFINIÇÕES: cada item explica um termo COMO ELE FOI EXPLICADO NA GRAVAÇÃO — tabela, ' +
  'parâmetro, arquivo, tecla, conceito do SIGER. NÃO escreva definição genérica de ' +
  'dicionário e NÃO invente o significado de uma sigla: se o consultor não explicou o que ' +
  'ela é, ela não entra nesta seção.\n\n' +
  'FORMATO EXATO DA RESPOSTA (duas seções, nesta ordem):\n\n' +
  'Registro de Atividades por Menu do Sistema\n' +
  '<um bloco por menu/rotina abordada, no formato:>\n' +
  '<Menu com código – nome, ou nome próprio da rotina>:\n' +
  'Ação: <o que foi executado>\n' +
  'Finalidade: <para que serve / o que resolve>\n' +
  '<mais linhas rotuladas conforme o caso, ver acima>\n\n' +
  'Definições de Configuração\n' +
  '<um item por conceito, termo, tabela, arquivo ou parâmetro explicado, no formato:>\n' +
  '<Termo>: <explicação clara e objetiva de como funciona e para que serve>\n\n' +
  'EXEMPLO DO ESTILO ESPERADO — o conteúdo abaixo é de um treinamento de CAIXA e é ' +
  'puramente ilustrativo. Copie a ESTRUTURA (títulos com código de menu, variedade de ' +
  'rótulos, definições ancoradas no que foi dito); NUNCA reaproveite o conteúdo. Se a ' +
  'gravação não falar de caixa/conciliação, nada daqui pode aparecer na sua resposta:\n\n' +
  'Registro de Atividades por Menu do Sistema\n' +
  'Menu 4 – Movimentos de Caixa / Conta Corrente (Inclusão de Movimento):\n' +
  'Ação: Execução de lançamentos manuais utilizando a tecla F4 para acionamento de ' +
  'Matrizes de Integração.\n' +
  'Finalidade: Registrar movimentos que não possuem origem no Contas a Pagar ou Receber ' +
  '(ex.: juros, tarifas), onde o sistema carrega automaticamente as contas de débito, ' +
  'crédito e histórico baseando-se na matriz selecionada via F8.\n' +
  'Menu M – Manutenção de Históricos / Importação de Extrato (FX):\n' +
  'Ação: Configuração do caminho de diretório para busca de arquivos bancários e ' +
  'definição de períodos de importação via F3.\n' +
  'Configuração: Amarração de históricos bancários às matrizes de integração, garantindo ' +
  'que, na leitura do arquivo FX, o sistema identifique automaticamente a natureza do ' +
  'lançamento.\n' +
  'Recurso: Uso da tecla F8 para explorar arquivos dentro do diretório padrão configurado.\n' +
  'Rotina de Conciliação Bancária:\n' +
  'Ação: Confronto entre os movimentos internos do SIGER e o extrato bancário importado.\n' +
  'Processamento: Execução da Conciliação Automática por critérios de data e valor.\n' +
  'Automação: Uso do comando "Cria Movimento" para gerar lançamentos automáticos para ' +
  'itens do extrato que já possuem matriz associada.\n' +
  'Correção: Procedimento de "Desconciliar" para permitir a alteração de históricos ou ' +
  'valores em lançamentos já integrados que apresentem inconsistências.\n' +
  'Menu 1 > Tabela 4 > Tabela 8 – Tabelas por Empresa (Manutenção Consolidada):\n' +
  'Ação: Manutenção e criação da base de dados das Matrizes de Integração.\n' +
  'Parâmetros: Configuração de regras de contrapartida contábil por empresa, visto que ' +
  'códigos de caixa e banco variam entre as unidades.\n\n' +
  'Definições de Configuração\n' +
  'Matriz de Integração: Conjunto de regras pré-definidas que automatiza o lançamento ' +
  'contábil (débito/crédito) e o histórico, eliminando a necessidade de conhecimento ' +
  'contábil técnico por parte do operador financeiro.\n' +
  'Conta 99 (Coringa): Código utilizado dentro da matriz para direcionar lançamentos a ' +
  'contas de despesas variadas sem criar um código de caixa específico para cada gasto.\n' +
  'Arquivo FX/OFX: Formato de arquivo digital fornecido pelas instituições bancárias para ' +
  'importação de movimentos financeiros no sistema.';

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

/**
 * Resgata os campos de um JSON que veio CORTADO.
 *
 * O corte é uma possibilidade real, não teórica: a saída é limitada a 8.000 tokens e o
 * formato pede ~24 seções, uma delas sendo "TODOS os menus citados no treinamento". Num
 * treinamento longo o modelo chega ao teto no meio de um campo, e aí não existe `}` final.
 *
 * Até 2026-08-11 isso custava o registro INTEIRO: sem `}`, o `JSON.parse` falhava, a regex
 * de resgate (que exigia o fecha-chaves) não casava, e a função devolvia `null` — descartando
 * em silêncio todos os campos que tinham chegado completos. Aproveitar o que veio é sempre
 * melhor do que perder tudo: o revisor completa um campo faltante, mas não reconstrói um
 * protocolo vazio.
 *
 * Só recolhe pares `"chave": "valor"` FECHADOS — o campo que estava sendo escrito na hora do
 * corte fica de fora, em vez de entrar pela metade.
 */
export function resgatarCamposDeJsonCortado(
  txt: string,
): Record<string, string> {
  const campos: Record<string, string> = {};
  const re = /"([a-z_]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt)) !== null) {
    try {
      // Reaproveita o parser para desescapar \n, \" e afins do jeito certo.
      campos[m[1]] = JSON.parse(`"${m[2]}"`) as string;
    } catch {
      // O parser recusa coisas que o modelo emite na prática — a mais comum é uma quebra de
      // linha DE VERDADE dentro da string (JSON exige `\n`). Desescapa à mão em vez de
      // perder o campo: aqui já estamos no caminho do resgate, e um texto com escape
      // imperfeito continua sendo útil para quem revisa.
      campos[m[1]] = m[2]
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
  }
  return campos;
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
        // Cai no resgate: JSON malformado ainda costuma ter campos inteiros aproveitáveis.
      }
    }
    const resgatados = resgatarCamposDeJsonCortado(txt || '');
    return Object.keys(resgatados).length > 0 ? resgatados : null;
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

  /** `menusReconhecidos` é a lista de menus do catálogo REAL do SIGER que foram encontrados
   * na transcrição (ver `menus-mencionados.ts`). Entregá-la aqui muda o trabalho da IA: em
   * vez de adivinhar o código do menu a partir de um texto onde ele chegou mastigado
   * ("um ponto quatro i"), ela escolhe dentro do que existe. Vazia, o comportamento é o de
   * antes — a IA extrai o que conseguir do texto. */
  async analisar(
    transcricao: string,
    videoNome = '',
    menusReconhecidos = '',
  ): Promise<ResultadoAnaliseIa> {
    const bloco = menusReconhecidos.trim()
      ? '\n\nMENUS DO SIGER RECONHECIDOS NESTA GRAVAÇÃO (catálogo oficial — use ESTES ' +
        'códigos e nomes; não invente nem reescreva o código):\n' +
        `${menusReconhecidos.trim()}\n`
      : '';
    const user = `Vídeo: ${videoNome}${bloco}\n\nTRANSCRIÇÃO (com timestamps):\n${transcricao}`;
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
      // resumoCompleto vem da 2ª chamada (resumirCompleto) — sem chave aqui, e não pode
      // ser zerado por este laço.
      if (!chave) continue;
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

  /** Resumo COMPLETO da transcrição, em texto (não JSON): registro de atividades por menu
   * do sistema + definições de configuração. Chamada separada da `analisar` — ver
   * SISTEMA_RESUMO. `maxTokens` fica abaixo de 8192 de propósito: é o teto de saída de
   * vários modelos que o usuário pode configurar em Config → IA.
   *
   * `menusReconhecidos` é a MESMA lista entregue à `analisar` — e não recebê-la era o
   * defeito relatado em 2026-08-12 ("o resumo não traz os menus"). O reconhecimento contra o
   * catálogo entrou em 2026-08-11 só na análise; o resumo continuou tendo de adivinhar o
   * código a partir de um texto onde ele chega mastigado ("um ponto quatro i"), e o
   * resultado era bloco intitulado por assunto genérico em CAIXA ALTA no lugar do menu. */
  async resumirCompleto(
    transcricao: string,
    videoNome = '',
    menusReconhecidos = '',
  ): Promise<string> {
    const bloco = menusReconhecidos.trim()
      ? '\n\nMENUS DO SIGER RECONHECIDOS NESTA GRAVAÇÃO (catálogo oficial — use ESTES ' +
        'códigos e nomes nos títulos dos blocos; não invente nem reescreva o código):\n' +
        `${menusReconhecidos.trim()}\n`
      : '';
    const user = `Vídeo: ${videoNome}${bloco}\n\nTRANSCRIÇÃO (com timestamps):\n${transcricao}`;
    const texto = await this.ia.completar('protocolos', {
      system: SISTEMA_RESUMO,
      messages: [{ role: 'user', content: user }],
      maxTokens: 6000,
    });
    return (texto || '').trim();
  }
}
