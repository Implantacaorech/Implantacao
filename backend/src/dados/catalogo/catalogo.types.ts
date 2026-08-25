/** Tipos do CATÁLOGO DE CONSULTAS — o contrato público da API de Dados.
 *
 * A regra do projeto (2026-08-25) é: **toda e qualquer consulta a banco de dados externo
 * passa por uma API**. O catálogo é o que torna essa regra verificável: uma consulta só
 * existe se estiver declarada aqui, com nome estável, conexão, parâmetros tipados e teto de
 * linhas. Não há caminho para "montar SQL do lado do consumidor" — o SQL mora no servidor.
 *
 * Ver `src/dados/docs/api.md` (contrato) e
 * `vault/17 - ADR/ADR-0003 - API de Dados como fronteira unica de banco.md` (decisão). */

/** Bancos externos vinculados ao Painel. `painel_novo` NÃO entra: é o banco próprio da
 * aplicação, acessado pela camada Repository/TypeORM (decisão do usuário em 2026-08-25 —
 * o escopo da regra é o dado de terceiro). */
export type ChaveConexao = 'sicla' | 'portal_rech';

export const CONEXOES: Record<
  ChaveConexao,
  { rotulo: string; dialeto: string; origem: string }
> = {
  sicla: {
    rotulo: 'SICLA (Oracle)',
    dialeto: 'oracle',
    origem:
      'CRM/ERP interno da Rech — views POWERBI.* e tabelas SICLA.*. Cadastro em Sistema → Disponibilidade.',
  },
  portal_rech: {
    rotulo: 'Portal Rech (MySQL)',
    dialeto: 'mysql',
    origem:
      'Banco do portalrech.com.br — protocolo/aprovação de visita, que o SICLA não espelha. Cadastro em Sistema → Consultas BD.',
  },
};

/** Tipo do parâmetro, que define COMO ele é validado antes de virar bind.
 * - `data`         → `AAAA-MM-DD` (o formato-contrato de todas as telas);
 * - `competencia`  → `AAAA-MM` (indicadores, que comparam competência como texto);
 * - `inteiro`      → número inteiro;
 * - `texto`        → string aparada, com teto de tamanho;
 * - `texto_busca`  → como `texto`, mas o executor envolve em `%…%` (os SELECTs de busca do
 *                    SICLA recebem o curinga PRONTO — contrato herdado);
 * - `lista_texto`  → array de strings para um `IN`. O executor REESCREVE o SQL, trocando
 *                    `:nome` por `(:nome_0, :nome_1, …)` — o node-oracledb não tem o
 *                    "expanding bindparam" do SQLAlchemy. Lista vazia vira `(NULL)`, que
 *                    nunca casa (mesmo efeito de um `IN` sem valores). */
export type TipoParametro =
  | 'data'
  | 'competencia'
  | 'inteiro'
  | 'texto'
  | 'texto_busca'
  | 'datahora_minuto'
  | 'lista_texto';

export interface ParametroConsulta {
  /** Nome do bind, SEM os dois-pontos — é a chave que o consumidor manda em `parametros`. */
  nome: string;
  tipo: TipoParametro;
  obrigatorio: boolean;
  descricao: string;
  /** Teto de caracteres para os tipos de texto (default 200). */
  maxTamanho?: number;
}

/** De onde sai o SQL da consulta.
 * - `fixo`          → versionado no código (mudar exige commit);
 * - `consulta_salva`→ editável pelo Administrador em Sistema → Consultas BD (tabela
 *                     `consultas_bd`), com o texto padrão embutido como fallback. Este
 *                     segundo caso EXISTE de propósito: parte do SQL do SICLA foi validada
 *                     contra o banco real pelo Administrador e precisa continuar ajustável
 *                     sem release. O contrato (nome, parâmetros, teto) segue fixo. */
export type OrigemSql =
  | { tipo: 'fixo'; sql: string }
  | {
      /** Consulta CRIADA PELA TELA (Sistema → Consultas BD), publicada no catálogo pelo
       * Administrador. O SQL vive só em `consultas_bd` — não há texto embutido nem semente,
       * porque não existe versão "de código" dela. É o caminho que dá autonomia para
       * publicar consulta sem release; em troca, o contrato não passa por revisão de PR e
       * as checagens (bind × parâmetro, teto, nome) rodam na HORA DE SALVAR. */
      tipo: 'tela';
      slug: string;
    }
  | {
      /** SQL guardado na CONFIGURAÇÃO da conexão (tela Sistema → Ferramentas →
       * Disponibilidade), não em código nem em Consultas BD. É a terceira — e última —
       * origem de SQL do sistema: existe porque o SELECT de ocupação varia por instalação
       * e viaja junto das credenciais desde o Painel Flask. */
      tipo: 'config_conexao';
      campo: 'select' | 'selectTecnicos';
      /** Texto usado quando a configuração não traz nada. Vazio = a consulta depende de o
       * Administrador preencher o SELECT na tela (é o caso da ocupação). */
      sqlPadrao: string;
    }
  | {
      tipo: 'consulta_salva';
      slug: string;
      sqlPadrao: string;
      /** Como a consulta aparece em Sistema → Consultas BD quando é semeada. Só o catálogo
       * semeia (`CatalogoSeedService`): antes, cada módulo semeava a sua, e a lista do
       * Administrador dependia de quais módulos tinham subido. */
      semente: SementeConsulta;
    };

/** Metadados da linha de `consultas_bd` criada na semeadura. Não afetam a execução pela
 * API — afetam a TELA do Administrador (ordem na lista, se vira dashboard, em qual conexão
 * o "Testar" roda). */
export interface SementeConsulta {
  nome: string;
  /** Posição na lista de Consultas BD (menor primeiro). */
  ordem: number;
  /** `true` publica a consulta como dashboard — exige `colunaData`. */
  mostrarGrafico?: boolean;
  colunaData?: string;
  colunaSituacao?: string;
  /** Valor da coluna `conexao` de `consultas_bd`: `'sicla'` (default) ou `'portal'`.
   * Atenção: é o vocabulário DA TELA, mais antigo que o do catálogo — aqui `portal`,
   * lá `portal_rech`. */
  conexao?: 'sicla' | 'portal';
}

export interface ConsultaCatalogo {
  /** Identidade PÚBLICA e estável da consulta (`<assunto>.<ação>`, kebab-case por parte).
   * É o que o consumidor chama. Renomear é quebra de contrato — só em versão nova. */
  nome: string;
  titulo: string;
  descricao: string;
  conexao: ChaveConexao;
  /** Gate de MENU aplicado quando o chamador é um usuário do Painel (JWT): basta ter
   * `consulta` em UM dos menus da lista. É lista, e não menu único, porque a mesma consulta
   * costuma alimentar telas diferentes (o calendário de alocação serve a Execução → Agenda
   * e aos Dashboards) — exigir um menu só barraria metade de quem já a enxerga hoje.
   * Ausente = basta estar autenticado. Não se aplica a cliente de máquina, que é gateado
   * pelas consultas que o token dele autoriza. */
  menus?: string[];
  parametros: ParametroConsulta[];
  origem: OrigemSql;
  /** Envelopa o SQL resolvido antes de executar — usado quando a consulta é um RECORTE de
   * outra (ex.: a ficha de UMA RNS é a consulta de RNS embrulhada num `SELECT * FROM (…)
   * WHERE PEDIDO = :pedido`). Existe para que o recorte herde qualquer correção de schema
   * que o Administrador faça no SQL base, em vez de duplicar a consulta. */
  envelopar?: (sqlBase: string) => string;
  /** Teto de linhas trazidas do banco. É o mesmo valor que o módulo dono usa hoje — mudar
   * aqui muda o comportamento de produção. */
  limiteLinhas: number;
  /** Segundos de cache do resultado (0 = sem cache). Vale por (nome + parâmetros). */
  cacheSegundos: number;
  /** Módulo do Painel que hoje é dono desta consulta — rastreabilidade da migração
   * (fase 1: o módulo passa a chamar o catálogo em vez de montar SQL). */
  donoAtual: string;
  /** Versão do contrato em que a consulta entrou. */
  desde: string;
}
