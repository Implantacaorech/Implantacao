import { MigrationInterface, QueryRunner } from 'typeorm';

/** Modelos de e-mail editáveis (ver ModeloEmailService) — usados na notificação manual
 * de projeto e nos gatilhos automáticos de evento. Escrito à mão pelo mesmo motivo das
 * migrations anteriores (sem Postgres acessível para `migration:generate`). */
export class ModelosEmail1768752000000 implements MigrationInterface {
  name = 'ModelosEmail1768752000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "modelos_email" (
        "id" SERIAL PRIMARY KEY,
        "slug" varchar(80) NOT NULL DEFAULT '',
        "nome" varchar(200) NOT NULL DEFAULT '',
        "assunto" varchar(300) NOT NULL DEFAULT '',
        "corpo" text NOT NULL DEFAULT '',
        "etapa" varchar(80) NOT NULL DEFAULT '',
        "ativo" boolean NOT NULL DEFAULT true,
        "padrao" boolean NOT NULL DEFAULT false,
        "criado_em" TIMESTAMP NOT NULL DEFAULT now(),
        "atualizado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_modelos_email_slug" ON "modelos_email" ("slug");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "modelos_email";`);
  }
}
