/** Taxonomia da "Matriz por Menu — Funções SICLA": as funções implantáveis de
 * `SICLA.LISTA_FUNCOES`, agrupadas pela coluna **STRMENUS**.
 *
 * STRMENUS lista os menus onde a função aparece, separados por `;`, cada um no formato
 * `SIGLA` + código do menu. Uma função pertence a TODOS os módulos citados ali. Exemplo real
 * (código 3004, "Executar programa de ajuste específico"):
 *
 *   CTB94A;GPA94A;FAT94A;FIN94A;EST94A;GIN94A;PDV94A;GER.;GCO94A
 *   -> CTB, GPA, FAT, FIN, EST, GIN, PDV, GER, GCO
 *
 * O SQL é EDITÁVEL pelo Administrador (consulta nomeada, slug abaixo, tela Consultas BD),
 * com o default embutido aqui. */
export const SLUG_LISTA_FUNCOES = 'funcoes_sicla_lista';

export const NOME_LISTA_FUNCOES = 'Lista de Funções (SICLA) — Matriz por Menu';

/** Grupo dos que não têm módulo identificável em STRMENUS (coluna vazia, ou só pontuação
 * como `.`). Definição do usuário em 2026-07-29: em vez de sumirem, ficam visíveis num
 * balde próprio para alguém classificar depois. */
export const GRUPO_SEM_MODULO = 'Classificar';

/** SQL padrão — o `SELECT * FROM LISTA_FUNCOES WHERE ATIVO = 1 ORDER BY CODIGO DESC`
 * informado pelo usuário, com as colunas explicitadas e o schema `SICLA.` na frente.
 * Validado em 2026-07-29: **o prefixo é obrigatório** (sem ele, ORA-00942 nesta conexão);
 * 966 linhas na tabela, 894 com ATIVO = 1.
 *
 * Contrato de apelidos (case-insensitive): CODIGO, DESCRICAO, STRMENUS. */
export const SQL_LISTA_FUNCOES_PADRAO = `-- Funções implantáveis do SIGER que alimentam a Matriz por Menu (Funções SICLA).
-- Origem informada pelo usuário: SELECT * FROM LISTA_FUNCOES WHERE ATIVO = 1 ORDER BY CODIGO DESC
-- O agrupamento por módulo é feito no Painel, quebrando STRMENUS por ";".
SELECT
  lf.CODIGO    AS CODIGO,
  lf.DESCRICAO AS DESCRICAO,
  lf.STRMENUS  AS STRMENUS
FROM SICLA.LISTA_FUNCOES lf
WHERE lf.ATIVO = 1
ORDER BY lf.CODIGO DESC`;

/** Uma função dentro de um módulo. `menus` são os tokens de STRMENUS que puseram a função
 * naquele grupo (ex.: `CTB94A`) — o "caminho" do menu, equivalente à coluna Caminho da
 * Matriz por Menu do Dicionário. */
export interface FuncaoSicla {
  /** CODIGO da função no SICLA — é o que entra na chave da nota (`SIGLA|codigo`). */
  codigo: string;
  descricao: string;
  menus: string;
  chave: string;
}

export interface ModuloFuncoes {
  sigla: string;
  titulo: string;
  funcoes: FuncaoSicla[];
}

/** Extrai a SIGLA do módulo de um token de STRMENUS.
 *
 * Regra: pega o prefixo antes do primeiro dígito e descarta pontuação de sobra
 * (`CTB94A` -> `CTB`, `GER.` -> `GER`, `PWE.` -> `PWE`). Normalizar o ponto final é
 * deliberado — sem isso a MESMA sigla vira dois grupos (`FAT` com 293 funções e `FAT.` com
 * 32; `GER` com 11 e `GER.` com 134), o que quebraria a matriz em duas linhas por módulo.
 * Com a normalização são ~80 grupos, 58 deles casando com uma sigla real do SICLA.
 *
 * Token sem nenhuma letra (`.`, `94A`, `1.5`) devolve '' — o chamador manda para
 * `GRUPO_SEM_MODULO`. */
export function siglaDoToken(token: string): string {
  const t = (token ?? '').trim();
  if (!t) return '';
  // Sem prefixo antes do primeiro dígito não há módulo nenhum ("94A", "1.5"): o token é só
  // código de menu solto. Devolver o token cru aqui criaria grupos fantasma.
  const prefixo = /^([^0-9]+)/.exec(t)?.[1];
  if (!prefixo) return '';
  const sigla = prefixo
    .replace(/[^A-Za-zÀ-ÿ]+$/, '')
    .toUpperCase()
    .trim();
  return /[A-ZÀ-Ÿ]/.test(sigla) ? sigla : '';
}
