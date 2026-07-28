import { MigrationInterface, QueryRunner } from 'typeorm';

/** Matriz de Conhecimento DETALHADA (por menu do SIGER): coluna de notas por menu, separada
 * da `notas` clássica (por competência). Blob JSON `{ "SIGLA|codigo": 0-10 }`. A taxonomia
 * dos menus é derivada do Dicionário (não fica no banco da Matriz). */
export class MatrizNotasMenu1784740000000 implements MigrationInterface {
  name = 'MatrizNotasMenu1784740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`matriz_tecnicos\` ADD \`notas_menu\` text NOT NULL DEFAULT ('{}')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`matriz_tecnicos\` DROP COLUMN \`notas_menu\``,
    );
  }
}
