import { MigrationInterface, QueryRunner } from 'typeorm';

/** Usuários passam a ser alimentados por `SICLA.LISTA_TECNICOS` (importação em
 * `tecnicos-sicla/`). Duas colunas novas guardam o que só existe lá: os módulos em que o
 * técnico é capacitado (MODULOCAPACITADO) e o setor de atuação (SETORDES). */
export class UsuariosTecnicosSicla1784760000000 implements MigrationInterface {
  name = 'UsuariosTecnicosSicla1784760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`usuarios\` ADD \`modulos_capacitados\` text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE \`usuarios\` ADD \`setor_atuacao\` varchar(120) NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`usuarios\` DROP COLUMN \`setor_atuacao\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`usuarios\` DROP COLUMN \`modulos_capacitados\``,
    );
  }
}
