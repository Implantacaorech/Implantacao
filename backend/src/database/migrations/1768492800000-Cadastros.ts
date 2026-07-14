import { MigrationInterface, QueryRunner } from 'typeorm';

/** Schema de Cadastros (IndiceTopico, ModeloDocumento+Versao+Campo, LevantamentoResposta,
 * DocConteudo) — pré-requisito da geração de documentos (ver
 * docs/migracao/03-documento-conversao.md, §6 item 6). Escrito à mão pelo mesmo motivo das
 * migrations anteriores (sem Postgres acessível para `migration:generate` neste ambiente). */
export class Cadastros1768492800000 implements MigrationInterface {
  name = 'Cadastros1768492800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "indice_topicos" (
        "id" SERIAL PRIMARY KEY,
        "ordem" integer NOT NULL DEFAULT 0,
        "modulo_num" varchar(10) NOT NULL DEFAULT '',
        "modulo_sigla" varchar(10) NOT NULL DEFAULT '',
        "modulo" varchar(120) NOT NULL DEFAULT '',
        "adicional_num" varchar(10) NOT NULL DEFAULT '',
        "adicional_sigla" varchar(10) NOT NULL DEFAULT '',
        "adicional" varchar(120) NOT NULL DEFAULT '',
        "topico" text NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_indice_topicos_ordem" ON "indice_topicos" ("ordem");`,
    );

    await queryRunner.query(`
      CREATE TABLE "modelos_documento" (
        "id" SERIAL PRIMARY KEY,
        "slug" varchar(40) NOT NULL DEFAULT '',
        "nome" varchar(160) NOT NULL DEFAULT '',
        "fase" varchar(40) NOT NULL DEFAULT '',
        "tipo" varchar(10) NOT NULL DEFAULT 'docx',
        "arquivo" varchar(200) NOT NULL DEFAULT '',
        "descricao" text NOT NULL DEFAULT '',
        "ordem" integer NOT NULL DEFAULT 0,
        "atualizado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_modelos_documento_slug" ON "modelos_documento" ("slug");`,
    );

    await queryRunner.query(`
      CREATE TABLE "modelos_documento_versoes" (
        "id" SERIAL PRIMARY KEY,
        "modelo_id" integer NOT NULL,
        "versao" integer NOT NULL DEFAULT 1,
        "arquivo" varchar(200) NOT NULL DEFAULT '',
        "autor" varchar(120) NOT NULL DEFAULT '',
        "motivo" text NOT NULL DEFAULT '',
        "vigente" boolean NOT NULL DEFAULT false,
        "criado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_modelos_documento_versoes_modelo_id" ON "modelos_documento_versoes" ("modelo_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "modelos_documento_campos" (
        "id" SERIAL PRIMARY KEY,
        "modelo_id" integer NOT NULL,
        "ordem" integer NOT NULL DEFAULT 0,
        "secao" varchar(120) NOT NULL DEFAULT '',
        "placeholder" varchar(200) NOT NULL DEFAULT '',
        "rotulo" varchar(160) NOT NULL DEFAULT '',
        "origem" varchar(160) NOT NULL DEFAULT '',
        "obrigatorio" boolean NOT NULL DEFAULT false,
        "observacao" text NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_modelos_documento_campos_modelo_id" ON "modelos_documento_campos" ("modelo_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "levantamento_respostas" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "ordem" integer NOT NULL DEFAULT 0,
        "modulo_sigla" varchar(10) NOT NULL DEFAULT '',
        "modulo" varchar(120) NOT NULL DEFAULT '',
        "adicional" varchar(120) NOT NULL DEFAULT '',
        "topico" text NOT NULL DEFAULT '',
        "resposta" text NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_levantamento_respostas_projeto_id" ON "levantamento_respostas" ("projeto_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "doc_conteudo" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "doc" varchar(30) NOT NULL DEFAULT '',
        "campo" varchar(60) NOT NULL DEFAULT '',
        "valor" text NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_doc_conteudo_projeto_id" ON "doc_conteudo" ("projeto_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "doc_conteudo";`);
    await queryRunner.query(`DROP TABLE "levantamento_respostas";`);
    await queryRunner.query(`DROP TABLE "modelos_documento_campos";`);
    await queryRunner.query(`DROP TABLE "modelos_documento_versoes";`);
    await queryRunner.query(`DROP TABLE "modelos_documento";`);
    await queryRunner.query(`DROP TABLE "indice_topicos";`);
  }
}
