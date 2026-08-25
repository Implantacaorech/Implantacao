/** SQL dos CADASTROS do SICLA (Oracle) — cliente, módulo/adicional, técnico, função.
 *
 * O texto mora aqui porque o catálogo é o dono do SQL (ADR-0003). Estes quatro são
 * `consulta_salva`: o que roda em produção é o texto de Sistema → Consultas BD, ajustado
 * pelo Administrador contra o banco real; o daqui é a SEMENTE e o fallback de banco
 * recém-criado. Alterar um destes textos NÃO muda produção — muda só o ponto de partida.
 */

/** SQL padrão. **AJUSTE OBRIGATÓRIO**: aponte para a SUA tabela/view de clientes do SICLA e
 * confirme os nomes reais das colunas. Este default usa a view de RN de Implantação, que já
 * está acessível pela conexão configurada — serve de ponto de partida.
 *
 * Contrato: o token `:termo` já chega COM `%` (curinga), casando código OU descrição/razão.
 * A busca mapeia as colunas por nome (CODIGO, CLIENTE/RAZAO/DESCRICAO, FANTASIA, CNPJ, RAMO,
 * RESPONSAVEL, CONTATO/EMAIL/TELEFONE) — qualquer coluna extra é ignorada sem erro. */
export const SQL_BUSCA_CLIENTE_PADRAO = `-- Busca de cliente no SICLA para iniciar a implantação (passo 1 do processo).
-- Validado contra SICLA.CLIENTES em 2026-07-27. :termo já chega com % (curinga) — casa
-- código OU nome/razão social. Ajuste as colunas se o cadastro do SICLA mudar.
SELECT
  C.CODIGO      AS CODIGO,
  C.NOME        AS CLIENTE,
  C.FANTASIA    AS FANTASIA,
  C.CNPJCPFMSK  AS CNPJ,
  C.COMERCIAL   AS RESPONSAVEL,
  C.COMERCIAL   AS CONTATO,
  C.ENDINT01    AS EMAIL
FROM SICLA.CLIENTES C
WHERE UPPER(TO_CHAR(C.CODIGO)) LIKE UPPER(:termo)
   OR UPPER(C.NOME)            LIKE UPPER(:termo)
ORDER BY C.CODIGO`;

/** SQL padrão. **AJUSTE OBRIGATÓRIO**: aponte para a(s) tabela(s) de módulos/adicionais do
 * seu SICLA e confirme os nomes das colunas. Contrato de apelidos (case-insensitive):
 *   CODMODULO    = código do módulo
 *   MODULO       = descrição do módulo
 *   CODADICIONAL = código do adicional (pode vir nulo)
 *   ADICIONAL    = descrição do adicional (pode vir nulo)
 * `:termo` já chega com `%` (curinga) — casa código OU descrição, de módulo ou adicional. */
export const SQL_BUSCA_MODULO_PADRAO = `-- Busca de módulos/adicionais no SICLA (passo 1). Fonte: SICLA.LISTA_SISTEMAS (validado 2026-07-27).
-- Módulo = MODULO=1; adicional = MODULO=0, ligado ao módulo pelo MESMO ZIP (self-join). Um
-- MODULO=0 sem módulo-pai no ZIP entra como item único (avulso). Código efetivo (regra do
-- usuário): do adicional quando há vínculo, senão o próprio código. :termo chega com % (curinga).
SELECT
  COALESCE(m.CODIGO, s.CODIGO)                                              AS CODMODULO,
  COALESCE(m.SIGLA, s.SIGLA) || ' - ' || COALESCE(m.DESCRICAO, s.DESCRICAO) AS MODULO,
  CASE WHEN s.MODULO = 0 AND m.CODIGO IS NOT NULL THEN s.CODIGO END                     AS CODADICIONAL,
  CASE WHEN s.MODULO = 0 AND m.CODIGO IS NOT NULL THEN s.SIGLA || ' - ' || s.DESCRICAO END AS ADICIONAL
FROM SICLA.LISTA_SISTEMAS s
LEFT JOIN SICLA.LISTA_SISTEMAS m ON m.ZIP = s.ZIP AND m.MODULO = 1 AND m.CODIGO <> s.CODIGO
WHERE s.ATIVO = 1
  AND ( UPPER(TO_CHAR(s.CODIGO)) LIKE UPPER(:termo)
     OR UPPER(s.DESCRICAO) LIKE UPPER(:termo)
     OR UPPER(s.SIGLA)     LIKE UPPER(:termo)
     OR UPPER(m.DESCRICAO) LIKE UPPER(:termo)
     OR UPPER(m.SIGLA)     LIKE UPPER(:termo) )
ORDER BY s.ZIP, s.MODULO DESC, s.CODIGO`;

/** SQL padrão. Base: o `SELECT * FROM LISTA_TECNICOS lt` informado pelo usuário, com as
 * colunas explicitadas e o schema `SICLA.` na frente — validado contra o SICLA em
 * 2026-07-29: **o prefixo é obrigatório**, `FROM LISTA_TECNICOS` puro devolve ORA-00942
 * nesta conexão (usuário `powerbi`).
 *
 * `WHERE lt.ATIVO = 1` é deliberado: a tabela tem 618 linhas — a empresa inteira, das
 * quais 368 são gente desligada (e-mails do tipo `fulano_inativo@rech.com.br`). Sobram
 * 250 ativos, todos com e-mail único, então não há colisão no login. Escopo confirmado
 * com o usuário em 2026-07-29.
 *
 * Contrato de apelidos (case-insensitive): CODIGO, NOME, MODULOCAPACITADO, EMAIL, SETORDES.
 * Sem bind de filtro de propósito — a lista é pequena, vem inteira e o filtro da tela é
 * aplicado em memória; assim um SQL editado sem `:termo` nunca quebra. */
export const SQL_LISTA_TECNICOS_PADRAO = `-- Técnicos do SICLA que alimentam o cadastro de Usuários do Painel.
-- Origem informada pelo usuário: SELECT * FROM LISTA_TECNICOS lt
-- ATIVO = 1 exclui os 368 desligados (a tabela cobre a empresa toda, 618 linhas).
SELECT
  lt.CODIGO           AS CODIGO,
  lt.NOME             AS NOME,
  lt.MODULOCAPACITADO AS MODULOCAPACITADO,
  lt.EMAIL            AS EMAIL,
  lt.SETORDES         AS SETORDES
FROM SICLA.LISTA_TECNICOS lt
WHERE lt.ATIVO = 1
ORDER BY lt.NOME`;

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
