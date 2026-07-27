/** Busca de cliente no SICLA para abrir a implantação (passo 1 do processo).
 *
 * O Comercial digita código OU parte da descrição/razão social; o Painel consulta o SICLA
 * (a MESMA conexão Oracle da Disponibilidade) e devolve os clientes que casam, para ele
 * selecionar e ter a ficha pré-preenchida.
 *
 * O SQL é EDITÁVEL pelo Administrador — fica guardado como uma consulta nomeada (slug
 * abaixo), na mesma tela de Consultas BD. Se a linha não existir no banco, cai no
 * `SQL_BUSCA_CLIENTE_PADRAO` daqui, então a busca funciona mesmo antes de qualquer ajuste.
 */
export const SLUG_BUSCA_CLIENTE = 'clientes_sicla_busca';

export const NOME_BUSCA_CLIENTE = 'Busca de Cliente (SICLA) — passo 1';

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

/** Cliente devolvido pela busca, já normalizado para a ficha. `bruto` traz a linha original
 * do SICLA (todas as colunas), para o front exibir o que quiser sem depender do mapeamento. */
export interface ClienteSicla {
  codigo: string;
  cliente: string;
  fantasia: string;
  cnpj: string;
  ramo: string;
  responsavel: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTel: string;
  bruto: Record<string, unknown>;
}
