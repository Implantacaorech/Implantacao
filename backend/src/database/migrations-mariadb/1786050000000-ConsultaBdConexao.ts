import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coluna `conexao` em `consultas_bd`: em qual conexão externa a consulta roda —
 * `sicla` (Oracle da Disponibilidade, o comportamento de sempre, default) ou `portal`
 * (banco do Portal Rech, MySQL, cadastrado em Sistema → Consulta BD). Nasce com o painel
 * "Visitas do Portal Rech" do BI (2026-08-17): a consulta do painel roda no banco do
 * Portal — o SICLA não carrega o nº de protocolo nem a aprovação de lá.
 * Aditiva: as consultas existentes ficam `sicla` (nada muda para elas). Em dev/teste
 * (SQLite) a coluna nasce por `synchronize`; em produção (MariaDB) por esta migration.
 */
export class ConsultaBdConexao1786050000000 implements MigrationInterface {
  name = 'ConsultaBdConexao1786050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`consultas_bd\` ADD \`conexao\` varchar(20) NOT NULL DEFAULT 'sicla'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`consultas_bd\` DROP COLUMN \`conexao\``,
    );
  }
}
