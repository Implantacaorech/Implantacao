import { MigrationInterface, QueryRunner } from 'typeorm';

/** Matriz de Conhecimento (notas 0-10 por técnico x competência) — catálogo de
 * competências + linhas por técnico. Escrito à mão pelo mesmo motivo das migrations
 * anteriores (sem Postgres acessível para `migration:generate`). */
export class MatrizConhecimento1768924800000 implements MigrationInterface {
  name = 'MatrizConhecimento1768924800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "matriz_competencias" (
        "id" SERIAL PRIMARY KEY,
        "sigla" varchar(80) NOT NULL DEFAULT '',
        "area" varchar(80) NOT NULL DEFAULT '',
        "ordem" integer NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_matriz_competencias_sigla" ON "matriz_competencias" ("sigla");`,
    );

    await queryRunner.query(`
      CREATE TABLE "matriz_tecnicos" (
        "id" SERIAL PRIMARY KEY,
        "nome" varchar(120) NOT NULL DEFAULT '',
        "setor" varchar(80) NOT NULL DEFAULT '',
        "dias" varchar(20) NOT NULL DEFAULT '',
        "notas" text NOT NULL DEFAULT '{}',
        "atualizado_em" TIMESTAMP,
        "atualizado_por" varchar(120) NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_matriz_tecnicos_nome" ON "matriz_tecnicos" ("nome");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "matriz_tecnicos";`);
    await queryRunner.query(`DROP TABLE "matriz_competencias";`);
  }
}
