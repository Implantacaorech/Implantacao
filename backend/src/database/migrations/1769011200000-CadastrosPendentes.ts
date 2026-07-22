import { MigrationInterface, QueryRunner } from 'typeorm';

/** Auto-cadastro (código de verificação por e-mail) — linhas pendentes até a confirmação.
 * Escrito à mão pelo mesmo motivo das migrations anteriores (sem Postgres acessível para
 * `migration:generate`). */
export class CadastrosPendentes1769011200000 implements MigrationInterface {
  name = 'CadastrosPendentes1769011200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cadastros_pendentes" (
        "id" SERIAL PRIMARY KEY,
        "nome" varchar(120) NOT NULL DEFAULT '',
        "login" varchar(120) NOT NULL DEFAULT '',
        "email" varchar(160) NOT NULL DEFAULT '',
        "senha_hash" text NOT NULL DEFAULT '',
        "codigo_sicla" varchar(40) NOT NULL DEFAULT '',
        "codigo" varchar(6) NOT NULL DEFAULT '',
        "tentativas" integer NOT NULL DEFAULT 0,
        "criado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cadastros_pendentes_email" ON "cadastros_pendentes" ("email");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cadastros_pendentes";`);
  }
}
