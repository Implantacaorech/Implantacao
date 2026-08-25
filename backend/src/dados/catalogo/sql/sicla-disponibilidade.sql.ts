/** SQL da DISPONIBILIDADE dos consultores.
 *
 * Caso único no catálogo: o texto que roda vem da CONFIGURAÇÃO da conexão (tela Sistema →
 * Ferramentas → Disponibilidade), porque o SELECT de ocupação varia por instalação e viaja
 * junto das credenciais desde o Painel Flask. O daqui é só a SEMENTE do mapa de técnicos —
 * a ocupação não tem semente de propósito: adivinhar um SELECT contra a agenda de um
 * terceiro é pior que dizer ao Administrador que falta preencher.
 */

// Espelha webapp/disponibilidade.py:SELECT_TECNICOS_PADRAO — casa o cadastro (código OU
// nome) com o NOME canônico do técnico no SICLA.
export const SELECT_TECNICOS_PADRAO =
  'SELECT CODIGO AS codigo, TECNICO AS tecnico FROM SICLA.TECNICOS';
