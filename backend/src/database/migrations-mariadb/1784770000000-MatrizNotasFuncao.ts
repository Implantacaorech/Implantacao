import { MigrationInterface, QueryRunner } from 'typeorm';

/** Terceira visão da Matriz: "Matriz por Menu — Funções SICLA". As notas ficam num blob
 * próprio (`{ "SIGLA|codigoFuncao": 0-10 }`), separado de `notas` (clássica) e `notas_menu`
 * (por menu do Dicionário), para as três coexistirem sem interferência. */
export class MatrizNotasFuncao1784770000000 implements MigrationInterface {
  name = 'MatrizNotasFuncao1784770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`matriz_tecnicos\` ADD \`notas_funcao\` text NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`matriz_tecnicos\` DROP COLUMN \`notas_funcao\``,
    );
  }
}
