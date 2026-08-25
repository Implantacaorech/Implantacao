import {
  SQL_BUSCA_CLIENTE_PADRAO,
  SQL_BUSCA_MODULO_PADRAO,
  SQL_LISTA_TECNICOS_PADRAO,
  SQL_LISTA_FUNCOES_PADRAO,
} from './sql/sicla-cadastros.sql';
import { SQL_CONSULTA_RNS_PADRAO } from './sql/sicla-rns.sql';
import {
  SQL_CALENDARIO_ALOCACAO,
  SQL_HORAS_APLICADAS,
  SQL_AGENDAS,
} from './sql/sicla-agenda.sql';
import {
  SQL_RESUMO_IMPLANTACAO,
  SQL_EXTRATO_HORAS,
  SQL_EXTRATO_DESCRICAO,
  SQL_RNS_VINCULADAS,
  SQL_INDICADORES,
  SQL_MOVIMENTOS_AGRUPADOS,
  SQL_PREVISAO_INICIO_OFICIAL,
} from './sql/sicla-bi.sql';
import { SQL_VISITAS_PORTAL_PADRAO } from './sql/portal-rech.sql';
import { SELECT_TECNICOS_PADRAO } from './sql/sicla-disponibilidade.sql';
import { ConsultaCatalogo, ParametroConsulta } from './catalogo.types';

/** Versão do contrato. Sobe só em mudança INCOMPATÍVEL (coluna removida/renomeada,
 * parâmetro que vira obrigatório, consulta removida) — e aí `/v1` e `/v2` convivem.
 * Acrescentar consulta, ou parâmetro opcional, é compatível e NÃO sobe a versão. */
export const VERSAO_CONTRATO = 'v1';

/** Tetos de linhas por consulta. Vieram dos módulos donos (fase 0) e passaram a morar aqui
 * junto do resto do contrato — o teto É contrato: é o que separa "trouxe tudo" de "trouxe o
 * que coube". Mudar um destes valores muda o comportamento de produção. */
const LIMITE = {
  buscaCliente: 50,
  buscaModulo: 200,
  tecnicos: 1000,
  funcoes: 5000,
  rnsLista: 5000,
  rnsDetalhe: 200,
  calendario: 5000,
  horasAplicadas: 20000,
  biLinhas: 5000,
  biExtrato: 10000,
  biDescricao: 1,
  indicadores: 5000,
  movimentos: 2000,
  previsao: 5000,
  visitasPortal: 20000,
  ocupacao: 20000,
  tecnicosSicla: 5000,
} as const;

/** Teto absoluto de linhas por página, independente do que a consulta declare — protege o
 * consumidor de BI que pede tudo de uma vez, e o Painel de montar um JSON gigante. */
export const TAMANHO_PAGINA_MAX = 5000;
export const TAMANHO_PAGINA_PADRAO = 500;

/** Parâmetros que se repetem no catálogo. Espalhá-los à mão faria a descrição divergir
 * entre consultas — e a descrição é o que o consumidor externo lê. */
const P: Record<string, ParametroConsulta> = {
  dataIni: {
    nome: 'data_ini',
    tipo: 'data',
    obrigatorio: false,
    descricao: 'Início do período (AAAA-MM-DD), inclusive.',
  },
  dataFim: {
    nome: 'data_fim',
    tipo: 'data',
    obrigatorio: false,
    descricao: 'Fim do período (AAAA-MM-DD).',
  },
  mesIni: {
    nome: 'mes_ini',
    tipo: 'data',
    obrigatorio: true,
    descricao: 'Primeiro dia da janela (AAAA-MM-DD), inclusive.',
  },
  mesFim: {
    nome: 'mes_fim',
    tipo: 'data',
    obrigatorio: true,
    descricao: 'Primeiro dia APÓS a janela (AAAA-MM-DD) — fim exclusivo.',
  },
};

const obrigatorio = (p: ParametroConsulta): ParametroConsulta => ({
  ...p,
  obrigatorio: true,
});

/** ================================================================================
 *  CATÁLOGO DE CONSULTAS — a única porta de entrada aos bancos externos.
 *
 *  Toda entrada aqui é um CONTRATO: nome estável, conexão, parâmetros tipados e teto de
 *  linhas. Acrescentar consulta = acrescentar entrada; não existe caminho alternativo — a
 *  guarda `src/common/conformidade-api-dados.spec.ts` falha o CI se um módulo abrir
 *  conexão ou montar SQL por fora.
 *
 *  O catálogo NASCE espelhando o que o Painel já roda hoje (levantamento de 2026-08-25),
 *  com os MESMOS textos de SQL, binds e tetos dos módulos donos — de propósito: a fase 0
 *  cria a fronteira sem mudar comportamento nenhum em produção. A fase 1 vira a chave nos
 *  módulos (eles passam a chamar pelo nome) e o campo `donoAtual` deixa de existir.
 *  ================================================================================ */
export const CATALOGO: ConsultaCatalogo[] = [
  // ---------------------------------------------------------------- SICLA · cadastros
  {
    nome: 'sicla.clientes.buscar',
    titulo: 'Busca de cliente no SICLA',
    descricao:
      'Clientes do SICLA por código, nome ou fantasia — entrada do passo 1 do processo de implantação.',
    conexao: 'sicla',
    menus: ['novo_cliente'],
    parametros: [
      {
        nome: 'termo',
        tipo: 'texto_busca',
        obrigatorio: true,
        descricao:
          'Trecho do código, nome ou fantasia. O curinga % é aplicado pelo executor.',
        maxTamanho: 80,
      },
    ],
    origem: {
      tipo: 'consulta_salva',
      slug: 'clientes_sicla_busca',
      sqlPadrao: SQL_BUSCA_CLIENTE_PADRAO,
      semente: { nome: 'Busca de Cliente (SICLA) — passo 1', ordem: 99 },
    },
    limiteLinhas: LIMITE.buscaCliente,
    cacheSegundos: 0,
    donoAtual: 'clientes-sicla',
    desde: 'v1',
  },
  {
    nome: 'sicla.modulos.buscar',
    titulo: 'Busca de módulo/adicional no SICLA',
    descricao:
      'Módulos e adicionais do SIGER (SICLA.LISTA_SISTEMAS) por código, descrição ou sigla.',
    conexao: 'sicla',
    menus: ['novo_cliente'],
    parametros: [
      {
        nome: 'termo',
        tipo: 'texto_busca',
        obrigatorio: true,
        descricao: 'Trecho do código, descrição ou sigla.',
        maxTamanho: 80,
      },
    ],
    origem: {
      tipo: 'consulta_salva',
      slug: 'modulos_sicla_busca',
      sqlPadrao: SQL_BUSCA_MODULO_PADRAO,
      semente: {
        nome: 'Busca de Módulo/Adicional (SICLA) — passo 1',
        ordem: 98,
      },
    },
    limiteLinhas: LIMITE.buscaModulo,
    cacheSegundos: 300,
    donoAtual: 'modulos-sicla',
    desde: 'v1',
  },
  {
    nome: 'sicla.tecnicos.listar',
    titulo: 'Técnicos do SICLA',
    descricao:
      'Técnicos que alimentam o cadastro de Usuários do Painel. Sem parâmetro — o filtro por termo é aplicado em memória pelo consumidor, para que um SQL editado sem :termo nunca quebre.',
    conexao: 'sicla',
    menus: ['usuarios'],
    parametros: [],
    origem: {
      tipo: 'consulta_salva',
      slug: 'tecnicos_sicla_lista',
      sqlPadrao: SQL_LISTA_TECNICOS_PADRAO,
      semente: { nome: 'Lista de Técnicos (SICLA) — Usuários', ordem: 97 },
    },
    limiteLinhas: LIMITE.tecnicos,
    cacheSegundos: 600,
    donoAtual: 'tecnicos-sicla',
    desde: 'v1',
  },
  {
    nome: 'sicla.funcoes.listar',
    titulo: 'Funções implantáveis do SIGER',
    descricao:
      'Funções que alimentam a Matriz por Menu (Funções SICLA). Sem parâmetro.',
    conexao: 'sicla',
    menus: ['matriz_funcoes'],
    parametros: [],
    origem: {
      tipo: 'consulta_salva',
      slug: 'funcoes_sicla_lista',
      sqlPadrao: SQL_LISTA_FUNCOES_PADRAO,
      semente: {
        nome: 'Lista de Funções (SICLA) — Matriz por Menu',
        ordem: 96,
      },
    },
    limiteLinhas: LIMITE.funcoes,
    cacheSegundos: 600,
    donoAtual: 'matriz-funcoes',
    desde: 'v1',
  },

  // ---------------------------------------------------------------- SICLA · RNS
  {
    nome: 'sicla.rns.listar',
    titulo: 'RNS — assuntos por período de criação',
    descricao:
      'Itens de pedido do SICLA (LISTA_ITEMPED) criados na janela informada — origem da tela Execução → RNS.',
    conexao: 'sicla',
    menus: ['rns'],
    parametros: [obrigatorio(P.dataIni), obrigatorio(P.dataFim)],
    origem: {
      tipo: 'consulta_salva',
      slug: 'rns_lista_itemped',
      sqlPadrao: SQL_CONSULTA_RNS_PADRAO,
      semente: {
        nome: 'RNS — Consulta de assuntos (LISTA_ITEMPED)',
        ordem: 95,
      },
    },
    limiteLinhas: LIMITE.rnsLista,
    cacheSegundos: 60,
    donoAtual: 'rns',
    desde: 'v1',
  },
  {
    nome: 'sicla.rns.detalhar',
    titulo: 'RNS — ficha completa de um pedido',
    descricao:
      'Todos os itens de UMA RNS. É a `sicla.rns.listar` recortada por pedido, para herdar qualquer correção de schema feita no SQL base.',
    conexao: 'sicla',
    menus: ['rns'],
    parametros: [
      {
        nome: 'pedido',
        tipo: 'inteiro',
        obrigatorio: true,
        descricao: 'Número da RNS (pedido) no SICLA.',
      },
      P.dataIni,
      P.dataFim,
    ],
    origem: {
      tipo: 'consulta_salva',
      slug: 'rns_lista_itemped',
      sqlPadrao: SQL_CONSULTA_RNS_PADRAO,
      semente: {
        nome: 'RNS — Consulta de assuntos (LISTA_ITEMPED)',
        ordem: 95,
      },
    },
    envelopar: (base) =>
      `SELECT * FROM (\n${base}\n) WHERE PEDIDO = :pedido ORDER BY ITEM`,
    limiteLinhas: LIMITE.rnsDetalhe,
    cacheSegundos: 60,
    donoAtual: 'rns',
    desde: 'v1',
  },

  // ---------------------------------------------------------------- SICLA · agenda
  {
    nome: 'sicla.agenda.calendario',
    titulo: 'Calendário de alocação de agendas',
    descricao:
      'Compromissos do SICLA na janela informada — origem da tela Execução → Agenda e do BI de Alocação.',
    conexao: 'sicla',
    menus: ['agenda', 'dashboards'],
    parametros: [P.mesIni, P.mesFim],
    origem: { tipo: 'fixo', sql: SQL_CALENDARIO_ALOCACAO },
    limiteLinhas: LIMITE.calendario,
    cacheSegundos: 60,
    donoAtual: 'bi-agenda-alocacao',
    desde: 'v1',
  },
  {
    nome: 'sicla.agenda.horas-aplicadas',
    titulo: 'Horas aplicadas por agenda',
    descricao:
      'Horas efetivamente aplicadas na janela — complemento do BI de Alocação de Agendas.',
    conexao: 'sicla',
    menus: ['dashboards'],
    parametros: [P.dataIni, P.dataFim],
    origem: { tipo: 'fixo', sql: SQL_HORAS_APLICADAS },
    limiteLinhas: LIMITE.horasAplicadas,
    cacheSegundos: 300,
    donoAtual: 'bi-agenda-alocacao',
    desde: 'v1',
  },
  {
    nome: 'sicla.agendas.listar',
    titulo: 'Agendas do BI de Implantação',
    descricao: 'Agendas do SICLA na janela mensal — painel de agendas do BI.',
    conexao: 'sicla',
    menus: ['bi_implantacao'],
    parametros: [P.mesIni, P.mesFim],
    origem: { tipo: 'fixo', sql: SQL_AGENDAS },
    limiteLinhas: LIMITE.biLinhas,
    cacheSegundos: 300,
    donoAtual: 'bi-implantacao',
    desde: 'v1',
  },

  // ---------------------------------------------------------------- SICLA · BI
  {
    nome: 'sicla.bi.resumo-implantacao',
    titulo: 'Resumo das implantações',
    descricao:
      'RNS de implantação por data de contratação — painel principal do BI de Implantação.',
    conexao: 'sicla',
    menus: ['bi_implantacao'],
    parametros: [P.dataIni, P.dataFim],
    origem: { tipo: 'fixo', sql: SQL_RESUMO_IMPLANTACAO },
    limiteLinhas: LIMITE.biLinhas,
    cacheSegundos: 300,
    donoAtual: 'bi-implantacao',
    desde: 'v1',
  },
  {
    nome: 'sicla.bi.extrato-horas',
    titulo: 'Extrato de horas',
    descricao: 'Lançamentos de hora do SICLA na janela informada.',
    conexao: 'sicla',
    menus: ['bi_implantacao'],
    parametros: [P.dataIni, P.dataFim],
    origem: { tipo: 'fixo', sql: SQL_EXTRATO_HORAS },
    limiteLinhas: LIMITE.biExtrato,
    cacheSegundos: 300,
    donoAtual: 'bi-implantacao',
    desde: 'v1',
  },
  {
    nome: 'sicla.bi.extrato-descricao',
    titulo: 'Descrição de um lançamento de hora',
    descricao:
      'Texto completo de UM lançamento, identificado por protocolo + data/hora ao minuto.',
    conexao: 'sicla',
    menus: ['bi_implantacao'],
    parametros: [
      {
        nome: 'protocolo',
        // Numérico, não texto: a coluna `PROTOCOLO` é NUMBER no Oracle e mandar string
        // forçaria conversão implícita — o tipo de bind é contrato, não detalhe.
        tipo: 'inteiro',
        obrigatorio: true,
        descricao: 'Protocolo do atendimento no SICLA.',
      },
      {
        nome: 'datahora',
        tipo: 'datahora_minuto',
        obrigatorio: true,
        descricao: 'Data/hora do lançamento, no formato AAAA-MM-DD HH:MM.',
      },
    ],
    origem: { tipo: 'fixo', sql: SQL_EXTRATO_DESCRICAO },
    limiteLinhas: LIMITE.biDescricao,
    cacheSegundos: 300,
    donoAtual: 'bi-implantacao',
    desde: 'v1',
  },
  {
    nome: 'sicla.bi.rns-vinculadas',
    titulo: 'RNS vinculadas à implantação',
    descricao:
      'RNS filhas (conversão, desenvolvimento, BI) criadas na janela informada.',
    conexao: 'sicla',
    menus: ['bi_implantacao'],
    parametros: [P.dataIni, P.dataFim],
    origem: { tipo: 'fixo', sql: SQL_RNS_VINCULADAS },
    limiteLinhas: LIMITE.biLinhas,
    cacheSegundos: 300,
    donoAtual: 'bi-implantacao',
    desde: 'v1',
  },
  {
    nome: 'sicla.bi.indicadores',
    titulo: 'Indicadores por competência',
    descricao:
      'Indicadores mensais do SICLA. A view guarda a competência como AAAA/MM — a conversão a partir de AAAA-MM é do executor.',
    conexao: 'sicla',
    menus: ['dashboards'],
    parametros: [
      {
        nome: 'comp_ini',
        tipo: 'competencia',
        obrigatorio: true,
        descricao: 'Competência inicial (AAAA-MM).',
      },
      {
        nome: 'comp_fim',
        tipo: 'competencia',
        obrigatorio: true,
        descricao: 'Competência final (AAAA-MM).',
      },
    ],
    origem: { tipo: 'fixo', sql: SQL_INDICADORES },
    limiteLinhas: LIMITE.indicadores,
    cacheSegundos: 300,
    donoAtual: 'bi-indicadores',
    desde: 'v1',
  },
  {
    nome: 'sicla.bi.movimentos',
    titulo: 'Movimentos agrupados',
    descricao:
      'Movimentos já AGREGADOS no Oracle (técnico × tipo de movimento × cobrança). O filtro fino é em memória, de propósito — é o que evita o problema de escala que esta consulta existe para não repetir.',
    conexao: 'sicla',
    menus: ['dashboards'],
    parametros: [
      obrigatorio(P.dataIni),
      {
        nome: 'data_fim',
        tipo: 'data',
        obrigatorio: true,
        // O SQL herdado compara `< :data_fim`; quem chama informa o dia SEGUINTE ao último
        // que quer ver. Está no contrato porque um consumidor externo não tem como
        // adivinhar — e o erro seria silencioso (falta um dia no relatório, sem erro).
        descricao: 'Primeiro dia APÓS o período (AAAA-MM-DD) — fim EXCLUSIVO.',
      },
    ],
    origem: { tipo: 'fixo', sql: SQL_MOVIMENTOS_AGRUPADOS },
    limiteLinhas: LIMITE.movimentos,
    cacheSegundos: 300,
    donoAtual: 'bi-movimentos',
    desde: 'v1',
  },
  {
    nome: 'sicla.dashboards.previsao-inicio-oficial',
    titulo: 'Previsão de início oficial',
    descricao:
      'Clientes com previsão de início oficial no período — a consulta semeada dos Dashboards.',
    conexao: 'sicla',
    menus: ['dashboards'],
    parametros: [obrigatorio(P.dataIni), obrigatorio(P.dataFim)],
    // O texto é conferido/ajustado pelo Administrador contra a view real do SICLA — o
    // embutido aqui é só a semente. Era a única consulta sem fallback (o texto vivia dentro
    // do ConsultaBdService); com a semeadura centralizada no catálogo, deixou de ser exceção.
    origem: {
      tipo: 'consulta_salva',
      slug: 'previsao_inicio_oficial',
      sqlPadrao: SQL_PREVISAO_INICIO_OFICIAL,
      semente: {
        nome: 'Previsão Início Oficial',
        ordem: 1,
        mostrarGrafico: true,
        colunaData: 'PREVISAO_INICIO_OFICIAL',
        colunaSituacao: 'SITUACAO',
      },
    },
    limiteLinhas: LIMITE.previsao,
    cacheSegundos: 300,
    donoAtual: 'disponibilidade (Dashboards)',
    desde: 'v1',
  },

  // ------------------------------------------------- SICLA · disponibilidade (agendamento)
  // As DUAS únicas consultas cujo texto vem da CONFIGURAÇÃO da conexão (tela Sistema →
  // Ferramentas → Disponibilidade), e não de código nem de Consultas BD. Entraram no
  // catálogo na fase 2 do ADR-0003: até então rodavam por fora, direto no driver, e eram a
  // última porta de SQL a banco externo que não passava por aqui.
  {
    nome: 'sicla.disponibilidade.ocupacao',
    titulo: 'Ocupação dos consultores',
    descricao:
      'Compromissos do SICLA por técnico, data e turno na janela informada — base do Agendador de Visitas, da distribuição do cronograma e da capacidade do Centro Operacional.',
    conexao: 'sicla',
    menus: ['coordenacao', 'centro_operacional'],
    parametros: [
      obrigatorio(P.dataIni),
      obrigatorio(P.dataFim),
      {
        nome: 'tecnicos',
        tipo: 'lista_texto',
        obrigatorio: false,
        descricao:
          'NOMES dos técnicos — a consulta casa por nome, não por código. Lista vazia ou ausente = todos, e ela só é aplicada se a consulta configurada citar :tecnicos.',
        maxTamanho: 120,
      },
    ],
    // Sem `sqlPadrao`: o SELECT de ocupação varia por instalação e é preenchido pelo
    // Administrador na tela. Em branco, a consulta responde 503 dizendo exatamente isso —
    // é melhor que adivinhar um SELECT contra a agenda de um terceiro.
    origem: { tipo: 'config_conexao', campo: 'select', sqlPadrao: '' },
    limiteLinhas: LIMITE.ocupacao,
    // Sem cache AQUI de propósito: quem quer resposta rápida usa o cache de 180s do
    // `DisponibilidadeService.ocupacaoPorSlotCache`; a validação final de alocação usa o
    // caminho direto e não pode ver dado velho — agendaria em cima de outra visita.
    cacheSegundos: 0,
    donoAtual: 'disponibilidade',
    desde: 'v1',
  },
  {
    nome: 'sicla.disponibilidade.tecnicos',
    titulo: 'Técnicos do SICLA (código ↔ nome)',
    descricao:
      'Mapa de código para nome canônico do técnico — usado para traduzir o código do cadastro antes de consultar a ocupação, que casa por nome.',
    conexao: 'sicla',
    menus: ['coordenacao', 'centro_operacional'],
    parametros: [],
    origem: {
      tipo: 'config_conexao',
      campo: 'selectTecnicos',
      sqlPadrao: SELECT_TECNICOS_PADRAO,
    },
    limiteLinhas: LIMITE.tecnicosSicla,
    cacheSegundos: 600,
    donoAtual: 'disponibilidade',
    desde: 'v1',
  },

  // ---------------------------------------------------------------- Portal Rech
  {
    nome: 'portal.visitas.listar',
    titulo: 'Visitas registradas no Portal Rech',
    descricao:
      'Visitas com número de protocolo e aprovação — dado que só existe no banco do Portal (o SICLA não o espelha, e a API do Portal é escopada por usuário).',
    conexao: 'portal_rech',
    menus: ['bi_implantacao'],
    parametros: [P.dataIni, P.dataFim],
    origem: {
      tipo: 'consulta_salva',
      slug: 'bi_visitas_portal',
      sqlPadrao: SQL_VISITAS_PORTAL_PADRAO,
      semente: {
        nome: 'BI — Visitas do Portal Rech (aprovação)',
        ordem: 96,
        conexao: 'portal',
      },
    },
    limiteLinhas: LIMITE.visitasPortal,
    cacheSegundos: 300,
    donoAtual: 'bi-implantacao',
    desde: 'v1',
  },
];

const POR_NOME = new Map(CATALOGO.map((c) => [c.nome, c]));

export function consultaPorNome(nome: string): ConsultaCatalogo | undefined {
  return POR_NOME.get((nome || '').trim());
}

/** Nomes de TODAS as consultas do catálogo em código — a lista fechada que um token pode
 * autorizar. Desde 2026-08-25 a autorização é POR CONSULTA, não por conexão: um token que
 * serve para `sicla.rns.listar` não abre o resto do SICLA. Derivada do catálogo, nunca
 * digitada à mão em dois lugares. */
export function nomesDisponiveis(): string[] {
  return CATALOGO.map((c) => c.nome).sort();
}
