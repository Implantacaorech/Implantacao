import { MigrationInterface, QueryRunner } from 'typeorm';

/** Linhas editáveis do Cronograma/Check List + histórico de modificações. Escrito à mão
 * pelo mesmo motivo das migrations anteriores (sem Postgres acessível para
 * `migration:generate`). */
export class PlanoCronograma1769097600000 implements MigrationInterface {
  name = 'PlanoCronograma1769097600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cronograma_itens" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "ordem" integer NOT NULL DEFAULT 0,
        "etapa" text NOT NULL DEFAULT '',
        "topicos" text NOT NULL DEFAULT '',
        "horas" varchar(20) NOT NULL DEFAULT '',
        "data" varchar(20) NOT NULL DEFAULT '',
        "modalidade" varchar(40) NOT NULL DEFAULT '',
        "status" varchar(30) NOT NULL DEFAULT 'Previsto'
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cronograma_itens_projeto_id" ON "cronograma_itens" ("projeto_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "checklist_itens" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "ordem" integer NOT NULL DEFAULT 0,
        "modulo" varchar(80) NOT NULL DEFAULT '',
        "item" text NOT NULL DEFAULT '',
        "responsavel" varchar(160) NOT NULL DEFAULT '',
        "status" varchar(30) NOT NULL DEFAULT 'Pendente',
        "obs" text NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_checklist_itens_projeto_id" ON "checklist_itens" ("projeto_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "modificacoes" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "entidade" varchar(30) NOT NULL DEFAULT '',
        "ref" varchar(60) NOT NULL DEFAULT '',
        "campo" varchar(40) NOT NULL DEFAULT '',
        "de" text NOT NULL DEFAULT '',
        "para" text NOT NULL DEFAULT '',
        "autor" varchar(120) NOT NULL DEFAULT '',
        "criado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_modificacoes_projeto_id" ON "modificacoes" ("projeto_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "modificacoes";`);
    await queryRunner.query(`DROP TABLE "checklist_itens";`);
    await queryRunner.query(`DROP TABLE "cronograma_itens";`);
  }
}
