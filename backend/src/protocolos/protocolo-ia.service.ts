import { Injectable, Logger } from '@nestjs/common';
import { IaService } from '../ia/ia.service';
import { PROTO_CAMPOS_TEXTO, PROTO_MODULOS } from './protocolos.constants';
import {
  codigosInexistentesNoTexto,
  validarMenuPrincipal,
} from './validar-menus';

// Exportado para o teste de regressão de prompt (eixo 6): o `prompts-regressao.spec.ts` trava
// a remoção acidental das cláusulas de fundamentação (grounding) que seguram a alucinação.
export const SISTEMA =
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
export const SISTEMA_RESUMO =
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

/** Acima deste tamanho de transcrição (em caracteres) a leitura única é trocada pela
 * CONDENSAÇÃO EM PARTES. Dimensionado pelo caso real de 2026-08-19: um vídeo longo virou um
 * prompt de 43.959 tokens e o servidor local (32k de contexto) TRUNCOU o começo do prompt —
 * exatamente onde estavam as instruções de responder em JSON — e a resposta veio em prosa
 * ("A IA não devolveu o JSON esperado"). O log do Ollama mostrou o corte em 16.386 tokens de
 * ENTRADA; a ~3,5 caracteres por token em pt-BR, 38 mil caracteres de transcrição + o prompt
 * de sistema (~3 mil tokens) ficam com folga abaixo desse teto. */
const LIMITE_CHARS_LEITURA_UNICA = 38_000;

/** Tamanho alvo de cada parte na condensação (~9 mil tokens): cabe com folga no teto de
 * entrada observado e mantém cada chamada num tempo razoável em CPU. */
const ALVO_CHARS_PARTE = 30_000;

/** Teto de saída de cada registro parcial. Baixo de propósito: o consolidado das partes é a
 * ENTRADA da análise final e precisa caber lá também (um vídeo de ~5 h dá ~8 partes;
 * 8 × 1.200 tokens + prompt de sistema ainda ficam abaixo do teto de entrada). */
const MAX_TOKENS_MAPA = 1200;

/** Prompt do registro PARCIAL (fase de mapa da condensação): extrai de UMA parte da
 * transcrição tudo o que a análise final precisa, preservando códigos e timestamps ao pé da
 * letra. Carrega as mesmas cláusulas de fundamentação dos outros dois prompts — o
 * `prompts-regressao.spec.ts` trava a remoção acidental delas. */
export const SISTEMA_MAPA =
  'Você é um consultor especialista em documentação de treinamentos do ERP SIGER (Rech). ' +
  'Você receberá UMA PARTE da transcrição de uma gravação longa, que foi dividida em partes ' +
  'sequenciais. Escreva o REGISTRO TÉCNICO DETALHADO desta parte, em português do Brasil — ' +
  'ele será consolidado com o das demais partes para documentar o treinamento inteiro.\n\n' +
  'REGRAS:\n' +
  '1. NUNCA invente informação — use apenas o que está realmente nesta parte da transcrição.\n' +
  "2. Se faltar detalhe, escreva exatamente: 'Informação não detalhada no vídeo'.\n" +
  '3. Preserve AO PÉ DA LETRA códigos de menu (ex.: 3.4-L), nomes de telas/rotinas, teclas e ' +
  'parâmetros citados — não normalize, não complete e não invente códigos.\n' +
  '4. Referencie o tempo da gravação entre colchetes, ex.: [12:35], em cada bloco.\n' +
  '5. Descarte conversa paralela, cumprimentos, assuntos pessoais/comerciais e repetições — ' +
  'só conteúdo técnico do treinamento.\n\n' +
  'FORMATO: texto corrido estruturado em blocos, um por menu/rotina/assunto técnico tratado ' +
  'nesta parte, cada um com: o que foi executado (ações e passo a passo demonstrado), ' +
  'configurações e parâmetros alterados, conceitos definidos pelo consultor, perguntas do ' +
  'participante com as respostas dadas, e pendências citadas. Sem introdução nem conclusão — ' +
  'apenas o registro.';

/** Divide a transcrição em partes de até `alvoChars`, quebrando SEMPRE em fim de linha —
 * cada linha carrega seu timestamp, então nenhuma parte começa no meio de uma fala. Linha
 * única maior que o alvo (transcrição sem quebras) é fatiada no duro, que é o único jeito. */
export function dividirTranscricaoEmPartes(
  texto: string,
  alvoChars: number,
): string[] {
  if (texto.length <= alvoChars) return [texto];
  const partes: string[] = [];
  let atual: string[] = [];
  let tamanho = 0;
  const fecharParte = () => {
    if (atual.length > 0) {
      partes.push(atual.join('\n'));
      atual = [];
      tamanho = 0;
    }
  };
  for (let linha of texto.split('\n')) {
    while (linha.length > alvoChars) {
      fecharParte();
      partes.push(linha.slice(0, alvoChars));
      linha = linha.slice(alvoChars);
    }
    if (tamanho + linha.length + 1 > alvoChars) fecharParte();
    atual.push(linha);
    tamanho += linha.length + 1;
  }
  fecharParte();
  return partes;
}

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
  private readonly logger = new Logger(ProtocoloIaService.name);

  /** Condensações já feitas, chaveadas pela transcrição ORIGINAL. Existe para a 2ª chamada
   * do pipeline (resumo completo) e para o "Processar agora" de uma nova tentativa não
   * repagarem a fase de mapa — que é a parte cara (em CPU, dezenas de minutos). Guarda só as
   * últimas; não é para crescer. */
  private readonly cacheCondensacao = new Map<string, string>();

  constructor(private readonly ia: IaService) {}

  disponivel(): boolean {
    return this.ia.disponivel('protocolos');
  }

  /** Transcrição que não cabe numa leitura única vira um REGISTRO CONSOLIDADO: divide em
   * partes (`dividirTranscricaoEmPartes`), extrai o registro detalhado de cada uma
   * (`SISTEMA_MAPA`) e junta tudo na ordem. Sem isto, o servidor local trunca o COMEÇO do
   * prompt — as instruções — e devolve prosa (caso de 2026-08-19). Abaixo do limite, a
   * transcrição passa intacta, comportamento de sempre. */
  private async condensarSeNecessario(
    transcricao: string,
    videoNome: string,
  ): Promise<{ texto: string; condensado: boolean }> {
    if (transcricao.length <= LIMITE_CHARS_LEITURA_UNICA) {
      return { texto: transcricao, condensado: false };
    }
    const emCache = this.cacheCondensacao.get(transcricao);
    if (emCache) return { texto: emCache, condensado: true };

    let texto = transcricao;
    // Uma rodada normalmente basta (reduz ~8×); a segunda cobre gravação extrema. Se ainda
    // assim passar do limite, segue adiante mesmo — o caso é teórico (dezenas de horas).
    for (
      let rodada = 0;
      rodada < 2 && texto.length > LIMITE_CHARS_LEITURA_UNICA;
      rodada++
    ) {
      texto = await this.condensarUmaRodada(texto, videoNome);
    }

    this.cacheCondensacao.set(transcricao, texto);
    while (this.cacheCondensacao.size > 4) {
      const maisAntiga = this.cacheCondensacao.keys().next().value;
      if (maisAntiga === undefined) break;
      this.cacheCondensacao.delete(maisAntiga);
    }
    return { texto, condensado: true };
  }

  private async condensarUmaRodada(
    texto: string,
    videoNome: string,
  ): Promise<string> {
    const partes = dividirTranscricaoEmPartes(texto, ALVO_CHARS_PARTE);
    this.logger.log(
      `Transcrição de ${texto.length} caracteres não cabe numa leitura única — ` +
        `condensando em ${partes.length} parte(s) antes da análise (${videoNome || 'vídeo'}).`,
    );
    const registros: string[] = [];
    for (let i = 0; i < partes.length; i++) {
      registros.push(
        await this.mapearParte(partes[i], i + 1, partes.length, videoNome),
      );
      this.logger.log(
        `Parte ${i + 1}/${partes.length} da transcrição registrada.`,
      );
    }
    return registros
      .map((r, i) => `=== Parte ${i + 1} de ${registros.length} ===\n${r.trim()}`)
      .join('\n\n');
  }

  private async mapearParte(
    parte: string,
    n: number,
    total: number,
    videoNome: string,
  ): Promise<string> {
    const opcoes = {
      system: SISTEMA_MAPA,
      messages: [
        {
          role: 'user' as const,
          content:
            `Vídeo: ${videoNome}\nParte ${n} de ${total} da transcrição.\n\n` +
            `TRANSCRIÇÃO DESTA PARTE (com timestamps):\n${parte}`,
        },
      ],
      maxTokens: MAX_TOKENS_MAPA,
    };
    const meta = {
      contexto: `protocolo (parte ${n}/${total}): ${videoNome || 'vídeo'}`,
    };
    try {
      return await this.ia.completar('protocolos', opcoes, meta);
    } catch (e) {
      // Uma parte que falha no meio de uma condensação longa custaria a rodada inteira —
      // uma nova tentativa antes de desistir é barata perto do que já foi gasto.
      this.logger.warn(
        `Parte ${n}/${total} falhou (${
          e instanceof Error ? e.message : String(e)
        }) — tentando de novo.`,
      );
      return await this.ia.completar('protocolos', opcoes, meta);
    }
  }

  /** Corpo do pedido: a transcrição direta, ou — quando condensada — o registro consolidado,
   * apresentado como tal para a IA não procurar uma "transcrição" que não veio. */
  private corpoDoPedido(texto: string, condensado: boolean): string {
    return condensado
      ? 'A gravação é longa e a transcrição foi processada em partes sequenciais. O ' +
          'REGISTRO CONSOLIDADO abaixo (com timestamps) substitui a transcrição — trate-o ' +
          `como a transcrição para este trabalho:\n${texto}`
      : `TRANSCRIÇÃO (com timestamps):\n${texto}`;
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
    // A15: catálogo de códigos válidos do SIGER para conferir a saída da IA. Vazio (o padrão)
    // = sem validação — em dev/teste, ou antes de ingerir o Dicionário, não há como afirmar
    // que um código "não existe".
    codigosValidos: Set<string> = new Set(),
  ): Promise<ResultadoAnaliseIa> {
    const { texto, condensado } = await this.condensarSeNecessario(
      transcricao,
      videoNome,
    );
    const bloco = menusReconhecidos.trim()
      ? '\n\nMENUS DO SIGER RECONHECIDOS NESTA GRAVAÇÃO (catálogo oficial — use ESTES ' +
        'códigos e nomes; não invente nem reescreva o código):\n' +
        `${menusReconhecidos.trim()}\n`
      : '';
    const user = `Vídeo: ${videoNome}${bloco}\n\n${this.corpoDoPedido(texto, condensado)}`;
    const bruto = await this.ia.completar(
      'protocolos',
      {
        system: SISTEMA,
        messages: [{ role: 'user', content: user }],
        maxTokens: 8000,
      },
      { contexto: videoNome ? `protocolo: ${videoNome}` : 'protocolo' },
    );
    const data = extraiJson(bruto);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      // O começo da resposta diz o que aconteceu de verdade (prosa? recusa? vazio?) — sem
      // ele, o diagnóstico exige reproduzir uma chamada de dezenas de minutos.
      const trecho = (bruto || '').trim().slice(0, 200);
      throw new Error(
        'A IA não devolveu o JSON esperado.' +
          (trecho ? ` A resposta começou com: "${trecho}"` : ' (resposta vazia)'),
      );
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
    this.validarMenusContraCatalogo(campos, codigosValidos);
    return { campos, bruto };
  }

  /** A15 — confere os menus da saída da IA contra o catálogo real do SIGER. O menu PRINCIPAL
   * inexistente é REJEITADO (vira "revisar manualmente"); códigos inexistentes citados no texto
   * são SINALIZADOS na lista do revisor (`pendencias`), sem reescrever o conteúdo. Catálogo
   * vazio não faz nada. */
  private validarMenusContraCatalogo(
    campos: ResultadoAnaliseIa['campos'],
    codigosValidos: Set<string>,
  ): void {
    if (codigosValidos.size === 0) return;
    const notas: string[] = [];

    const { menu, rejeitado } = validarMenuPrincipal(
      campos.menu || '',
      codigosValidos,
    );
    if (rejeitado) {
      campos.menu = menu;
      notas.push(
        `o menu principal "${rejeitado}" não existe no catálogo do SIGER (rebaixado para revisão manual)`,
      );
    }

    const inexistentes = codigosInexistentesNoTexto(
      campos.menusAbordados || '',
      codigosValidos,
    );
    if (inexistentes.length > 0) {
      notas.push(
        `códigos citados que não existem no catálogo: ${inexistentes.join(', ')}`,
      );
    }

    if (notas.length > 0) {
      const aviso = `⚠️ Validação automática de menus (A15): ${notas.join('; ')}.`;
      campos.pendencias = [campos.pendencias, aviso]
        .filter((s) => (s || '').trim())
        .join('\n');
    }
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
    // Mesma condensação da `analisar` — e, como o pipeline chama as duas com a MESMA
    // transcrição, a segunda sai do cache: a fase cara roda uma vez só.
    const { texto, condensado } = await this.condensarSeNecessario(
      transcricao,
      videoNome,
    );
    const bloco = menusReconhecidos.trim()
      ? '\n\nMENUS DO SIGER RECONHECIDOS NESTA GRAVAÇÃO (catálogo oficial — use ESTES ' +
        'códigos e nomes nos títulos dos blocos; não invente nem reescreva o código).\n' +
        '⚠️ Cada item vem com o TRECHO em que foi citado: são CANDIDATOS, não fatos. ' +
        'Alguns nomes de menu são termos correntes do dia a dia (ex.: "ordem de produção"), ' +
        'e citá-los não significa que a tela foi aberta. Leia o trecho: se ele mostra a tela ' +
        'sendo usada, use o menu; se é só a expressão aparecendo numa frase, IGNORE aquele ' +
        'candidato.\n' +
        `${menusReconhecidos.trim()}\n`
      : '';
    const user = `Vídeo: ${videoNome}${bloco}\n\n${this.corpoDoPedido(texto, condensado)}`;
    const resposta = await this.ia.completar(
      'protocolos',
      {
        system: SISTEMA_RESUMO,
        messages: [{ role: 'user', content: user }],
        maxTokens: 6000,
      },
      {
        contexto: videoNome
          ? `protocolo (resumo): ${videoNome}`
          : 'protocolo (resumo)',
      },
    );
    return (resposta || '').trim();
  }
}
