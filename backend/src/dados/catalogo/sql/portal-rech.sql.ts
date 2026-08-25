/** SQL do banco do PORTAL RECH (MySQL) — visitas com protocolo e aprovação, dado que o
 * SICLA não espelha. `consulta_salva`: o texto vigente é o de Sistema → Consultas BD. */

/** Painel do Resumo de Implantação: TODOS os protocolos de visita do Portal (de todos os
 * consultores), com a aprovação real — lidos DIRETO do banco do Portal Rech.
 *
 * Este default é a consulta do usuário (revisão de 2026-08-17: `v.ID AS PROTOCOLO` e
 * LEFT JOINs — toda visita aparece, mesmo sem aprovação/contato/usuário), com duas
 * adaptações mecânicas: a coluna `e.CODIGO_CLIENTE` (código do cliente no SICLA — amarra
 * o painel ao cliente filtrado, exigência do usuário) e os binds `:data_ini`/`:data_fim`
 * (o De/Até da tela, fim inclusive).
 *
 * Por que o banco do Portal (e não o SICLA nem a API): o SICLA não espelha nem o nº do
 * protocolo nem a aprovação (`VISITAS.PROTOCOLOVIS` ≠ `LISTA_VISITAS.PROTOCOLOVIS` ≠ id do
 * Portal — protocolos reais 135089/135096 provaram; `RECEBIDA` não é a aprovação), e a
 * listagem da API do Portal é escopada por usuário — não serve para ver TODOS os
 * protocolos do cliente. */
export const SQL_VISITAS_PORTAL_PADRAO = `-- Consulta do painel "Visitas do Portal Rech" (BI Implantação Clientes SIGER → Resumo,
-- abaixo do CONTROLE DE HORAS). Semeada pelo Painel; editável aqui.
-- Roda no BANCO DO PORTAL RECH (conexao = portal — cadastre a conexão nesta mesma tela);
-- dialeto MySQL/MariaDB. Os binds de período (data_ini/data_fim, com dois-pontos na
-- frente no corpo do SQL) são supridos pelo De/Até da tela, fim inclusive; removê-los
-- desliga o recorte. NÃO escreva um bind com dois-pontos DENTRO de comentário: o driver
-- embaralha os valores. Mantenha os ALIASES das colunas: são o contrato com a tela —
-- CODIGO_CLIENTE é o código do cliente no SICLA e é o que amarra a visita ao cliente
-- filtrado nos demais filtros do Resumo.
SELECT
    e.NOME_FANTASIA AS EMPRESA,
    e.CODIGO_CLIENTE AS CODIGO_CLIENTE,
    c.NOME AS CONTATO,
    u.SOBRENOME AS CONSULTOR,

    v.ID AS PROTOCOLO,

    DATE(v.DATA_INICIO_VISITA) AS DATA,

    TIME(v.DATA_INICIO_VISITA) AS HORARIO,

    CASE
        WHEN TIME(v.DATA_INICIO_VISITA) BETWEEN '07:00:00' AND '12:59:59'
            THEN 'MANHÃ'

        WHEN TIME(v.DATA_INICIO_VISITA) BETWEEN '13:00:00' AND '19:00:00'
            THEN 'TARDE'

        WHEN TIME(v.DATA_INICIO_VISITA) BETWEEN '19:01:00' AND '23:59:59'
            THEN 'NOITE'

        ELSE 'FORA DO TURNO'
    END AS TURNO,

    CASE
        WHEN va.APROVADO = 1
            THEN 'Sim'
        ELSE 'Não'
    END AS APROVADO

FROM visita v

LEFT JOIN visita_aprovacao va
    ON va.ID_VISITA = v.ID

INNER JOIN empresa e
    ON e.ID = v.ID_EMPRESA

LEFT JOIN contato c
    ON c.ID = v.ID_CONTATO

LEFT JOIN usuario u
    ON u.ID = v.ID_USUARIO

WHERE (:data_ini IS NULL OR v.DATA_INICIO_VISITA >= :data_ini)
  AND (:data_fim IS NULL OR v.DATA_INICIO_VISITA < DATE_ADD(:data_fim, INTERVAL 1 DAY))

ORDER BY
    e.NOME_FANTASIA,
    c.NOME,
    u.SOBRENOME,
    v.DATA_INICIO_VISITA`;
