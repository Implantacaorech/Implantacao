import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coluna `motivo_revogacao` em `refresh_tokens` (M11 — detecção de reuso de refresh token).
 * Aditiva: os tokens que já existiam ficam com `''` (comportamento anterior preservado). Em
 * dev/teste (SQLite) a coluna nasce por `synchronize`; em produção (MariaDB) por esta migration.
 */
export class RefreshTokenMotivo1784930000000 implements MigrationInterface {
  name = 'RefreshTokenMotivo1784930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD \`motivo_revogacao\` varchar(20) NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP COLUMN \`motivo_revogacao\``,
    );
  }
}
