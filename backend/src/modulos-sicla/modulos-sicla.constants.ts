/** Busca de módulos/adicionais no SICLA para marcar os contratados (passo 1).
 *
 * O Comercial digita código OU descrição; o Painel consulta o SICLA (mesma conexão Oracle da
 * Disponibilidade) e devolve os itens que casam, para ele marcar os contratados. Cada item é
 * um MÓDULO e, opcionalmente, um ADICIONAL daquele módulo.
 *
 * Regra de gravação (pedido do usuário): quando o item tem módulo E adicional, o código que
 * conta é o do ADICIONAL; quando só tem módulo, é o do MÓDULO. Esse "código efetivo" é o que
 * vai para `Projeto.modulos` (lista de códigos que os geradores leem).
 *
 * O SQL é EDITÁVEL pelo Administrador (consulta nomeada, slug abaixo), com um default
 * embutido — se a linha não existir no banco, cai no default e a busca ainda funciona. */
export const SLUG_BUSCA_MODULO = 'modulos_sicla_busca';

export const NOME_BUSCA_MODULO = 'Busca de Módulo/Adicional (SICLA) — passo 1';

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

/** Um item devolvido pela busca. `codigo`/`descricao` são os valores "efetivos" (já aplicando
 * a regra do adicional) — é o que se grava e se mostra no chip; os campos de módulo/adicional
 * ficam à parte para o layout. `bruto` traz a linha original do SICLA. */
export interface ModuloSicla {
  codModulo: string;
  descModulo: string;
  codAdicional: string;
  descAdicional: string;
  codigo: string;
  descricao: string;
  bruto: Record<string, unknown>;
}
