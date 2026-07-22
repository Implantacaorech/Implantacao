import { MigrationInterface, QueryRunner } from 'typeorm';

/** Consultas BD (SQLs nomeadas rodadas contra a conexão externa de Disponibilidade) —
 * base dos Dashboards. Escrito à mão pelo mesmo motivo das migrations anteriores (sem
 * Postgres acessível para `migration:generate`). */
export class ConsultasBd1768838400000 implements MigrationInterface {
  name = 'ConsultasBd1768838400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "consultas_bd" (
        "id" SERIAL PRIMARY KEY,
        "slug" varchar(60) NOT NULL DEFAULT '',
        "nome" varchar(160) NOT NULL DEFAULT '',
        "sql" text NOT NULL DEFAULT '',
        "ordem" integer NOT NULL DEFAULT 0,
        "coluna_data" varchar(120) NOT NULL DEFAULT '',
        "coluna_situacao" varchar(120) NOT NULL DEFAULT '',
        "mostrar_grafico" boolean NOT NULL DEFAULT false
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_consultas_bd_slug" ON "consultas_bd" ("slug");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "consultas_bd";`);
  }
}
