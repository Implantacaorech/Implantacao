import { MigrationInterface, QueryRunner } from 'typeorm';

/** Papéis MÚLTIPLOS por usuário (revisão do processo em 2026-07-22): a mesma pessoa
 * acumula cargos — costuma ser GCI e Levantador ao mesmo tempo.
 *
 * `perfil` continua existindo como papel principal (telas e dados antigos dependem dele);
 * `perfis` passa a ser a lista completa, e é ela que as permissões consultam. O backfill
 * copia o perfil atual para a lista, de modo que ninguém perde acesso na virada. */
export class PerfisMultiplos1784665200000 implements MigrationInterface {
  name = 'PerfisMultiplos1784665200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`usuarios\` ADD \`perfis\` text NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE \`usuarios\` SET \`perfis\` = \`perfil\` WHERE \`perfis\` = ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`usuarios\` DROP COLUMN \`perfis\``);
  }
}
