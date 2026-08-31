import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove o módulo **Consulta Wall-e** (decisão do usuário em 2026-08-19): derruba as três
 * tabelas do índice derivado (`walle_entidades`, `walle_arquivos`, `walle_chats` — criadas
 * pela migration 1787011200000, retirada junto com o módulo) e limpa o que o módulo semeava
 * em runtime — a consulta editável `walle_chats_sicla` (Consultas BD) e as permissões da
 * chave de menu `walle`.
 *
 * O acervo-fonte (`R:\GRM\CHAT_WALLE\`) NUNCA foi tocado pelo Painel e segue intacto: o
 * índice era 100% derivado dele, então o drop não perde nada de original. O código do
 * módulo fica no histórico do git (entrou em d643c89).
 */
export class RemoveWalle1787270400000 implements MigrationInterface {
  name = 'RemoveWalle1787270400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`walle_entidades\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`walle_arquivos\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`walle_chats\``);
    await queryRunner.query(
      `DELETE FROM \`consultas_bd\` WHERE \`slug\` = 'walle_chats_sicla'`,
    );
    await queryRunner.query(
      `DELETE FROM \`permissoes_papel\` WHERE \`menu\` = 'walle'`,
    );
    await queryRunner.query(
      `DELETE FROM \`permissoes_usuario\` WHERE \`menu\` = 'walle'`,
    );
  }

  public async down(): Promise<void> {
    // Sem volta automática: o módulo saiu do código (recuperável só pelo histórico do
    // git) — recriar as tabelas vazias sem o módulo não devolveria função nenhuma.
  }
}
