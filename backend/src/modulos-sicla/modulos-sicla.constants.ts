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
