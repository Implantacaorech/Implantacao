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

/** SQL padrão dos CONTATOS de cliente liberados no Portal Rech — a fonte do acesso externo
 * ao Painel (docs/acesso-cliente-bi.md).
 *
 * Origem informada pelo usuário (2026-08-31):
 *
 *     SELECT * FROM LISTA_CONTATOS lc
 *     --WHERE cliente = 3631
 *      WHERE lc.PORTAL_RECH_CLIENTES = 1
 *
 * `PORTAL_RECH_CLIENTES = 1` é o que o SICLA usa para dizer que aquele contato pode entrar
 * no portal — é a AUTORIZAÇÃO, não uma marcação qualquer. Por isso ela fica no SQL, e não
 * num filtro de tela: uma consulta que devolvesse contato não liberado convidaria a liberar
 * quem o SICLA não liberou.
 *
 * `:cliente` é opcional e recorta um cliente só (o `--WHERE cliente = 3631` comentado do
 * original) — é o que a tela usa ao abrir a lista de UM cliente.
 *
 * Colunas confirmadas pelo usuário em 2026-08-31. Note que **não há código de contato**: a
 * identidade é o E-MAIL, que também é o login no Painel. Contato sem e-mail não vira acesso.
 *
 * Contrato de apelidos (case-insensitive), que o Painel mapeia por NOME:
 *   CLIENTE                 = código do cliente (`LISTA_CLIENTES.CODIGO`) — vínculo e recorte do BI
 *   NOME                    = nome do contato
 *   CARGO                   = cargo, para o ADM saber quem está liberando
 *   EMAIL                   = e-mail — LOGIN do contato no Painel
 *   ATIVODES                = situação do contato no SICLA (descrição)
 *   STATUSDES               = status do contato (descrição)
 *   PORTAL_RECH_CLIENTES_DES = a própria liberação, por extenso — o que a tela mostra
 * Coluna extra é ignorada sem erro; coluna que falte deixa o campo vazio.
 *
 * O prefixo `SICLA.` é obrigatório nesta conexão: sem ele, ORA-00942 (provado com
 * `LISTA_TECNICOS` em 2026-07-29). */
export const SQL_LISTA_CONTATOS_PADRAO = `-- Contatos de cliente liberados no Portal Rech — quem pode receber acesso ao Painel.
-- Origem informada pelo usuário: SELECT * FROM LISTA_CONTATOS lc WHERE lc.PORTAL_RECH_CLIENTES = 1
-- :cliente é opcional: nulo lista todos os contatos liberados; preenchido, só os de um cliente.
SELECT
  lc.CLIENTE                  AS CLIENTE,
  lc.NOME                     AS NOME,
  lc.CARGO                    AS CARGO,
  lc.EMAIL                    AS EMAIL,
  lc.ATIVODES                 AS ATIVODES,
  lc.STATUSDES                AS STATUSDES,
  lc.PORTAL_RECH_CLIENTES_DES AS PORTAL_RECH_CLIENTES_DES
FROM SICLA.LISTA_CONTATOS lc
WHERE lc.PORTAL_RECH_CLIENTES = 1
  AND (:cliente IS NULL OR lc.CLIENTE = :cliente)
ORDER BY lc.NOME`;

/** SQL dos contatos de UM cliente — TODOS eles, liberados no Portal Rech ou não.
 *
 * Existe separada de `SQL_LISTA_CONTATOS_PADRAO` porque as duas respondem a perguntas
 * diferentes, e confundi-las foi um defeito real (relatado em 2026-09-03):
 *
 * - `sicla.contatos.listar` responde **"quem pode ter conta no Painel?"** — é AUTORIZAÇÃO, e
 *   por isso filtra `PORTAL_RECH_CLIENTES = 1`. O login do usuário-cliente revalida por ela.
 * - esta responde **"quem são as pessoas deste cliente?"** — é AGENDA. Serve para nomear, num
 *   cartão do Controle de Atividades, quem do lado do cliente responde pela tarefa. O próprio
 *   desenho do módulo diz que "um contato pode ser membro mesmo sem conta no Painel"
 *   (docs/controle-atividades.md §2.4), o que o filtro de autorização tornava impossível: no
 *   quadro de um cliente com um único contato liberado, o seletor oferecia uma pessoa só.
 *
 * **`:cliente` é OBRIGATÓRIO aqui**, ao contrário da irmã. Sem o filtro de autorização, um
 * `:cliente` nulo despejaria a agenda de contatos de TODA a base de clientes numa resposta —
 * e nenhuma tela precisa disso. É o recorte que mantém a consulta proporcional ao seu uso.
 *
 * Mesmo contrato de colunas da irmã, para o mapeamento do Painel servir às duas.
 *
 * O prefixo `SICLA.` é obrigatório nesta conexão (ORA-00942 sem ele). */
export const SQL_CONTATOS_DO_CLIENTE_PADRAO = `-- Contatos de UM cliente — todos, liberados no Portal Rech ou não.
-- Diferente de "contatos_sicla_lista": aquela é AUTORIZAÇÃO (PORTAL_RECH_CLIENTES = 1);
-- esta é a AGENDA do cliente, para nomear responsável de cartão no Controle de Atividades.
-- :cliente é OBRIGATÓRIO — sem ele isto viraria um dump da base inteira de contatos.
SELECT
  lc.CLIENTE                  AS CLIENTE,
  lc.NOME                     AS NOME,
  lc.CARGO                    AS CARGO,
  lc.EMAIL                    AS EMAIL,
  lc.ATIVODES                 AS ATIVODES,
  lc.STATUSDES                AS STATUSDES,
  lc.PORTAL_RECH_CLIENTES_DES AS PORTAL_RECH_CLIENTES_DES
FROM SICLA.LISTA_CONTATOS lc
WHERE lc.CLIENTE = :cliente
ORDER BY lc.NOME`;
