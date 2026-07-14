import { MigrationInterface, QueryRunner } from 'typeorm';

/** Documento (histórico/versionado de arquivos anexados a um projeto) e Evento (timeline)
 * — usados pela geração de documentos para registrar o cronograma de visitas gerado (e,
 * nas próximas fatias, Levantamento/Projeto/Termo). Escrito à mão pelo mesmo motivo das
 * migrations anteriores (sem Postgres acessível para `migration:generate`). */
export class DocumentosEventos1768579200000 implements MigrationInterface {
  name = 'DocumentosEventos1768579200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documentos" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "tipo" varchar(40) NOT NULL DEFAULT '',
        "arquivo" varchar(255) NOT NULL DEFAULT '',
        "caminho" text NOT NULL DEFAULT '',
        "origem" varchar(20) NOT NULL DEFAULT 'gerado',
        "criado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_documentos_projeto_id" ON "documentos" ("projeto_id");`);

    await queryRunner.query(`
      CREATE TABLE "eventos" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "tipo" varchar(30) NOT NULL DEFAULT 'nota',
        "descricao" text NOT NULL DEFAULT '',
        "autor" varchar(120) NOT NULL DEFAULT '',
        "criado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_eventos_projeto_id" ON "eventos" ("projeto_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "eventos";`);
    await queryRunner.query(`DROP TABLE "documentos";`);
  }
}
