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
