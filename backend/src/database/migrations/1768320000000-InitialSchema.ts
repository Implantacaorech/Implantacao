import { MigrationInterface, QueryRunner } from 'typeorm';

/** Schema inicial da migração (Usuario, Projeto, RefreshToken) — escrito à mão porque o
 * ambiente de desenvolvimento não tinha um Postgres acessível para `migration:generate`
 * (ver docs/migracao/03-documento-conversao.md, seção de pendências). Revisar com
 * `migration:generate` assim que houver uma instância de homologação disponível. */
export class InitialSchema1768320000000 implements MigrationInterface {
  name = 'InitialSchema1768320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "usuarios" (
        "id" SERIAL PRIMARY KEY,
        "login" varchar(120) NOT NULL,
        "nome" varchar(120) NOT NULL DEFAULT '',
        "email" varchar(160) NOT NULL DEFAULT '',
        "senha_hash" text NOT NULL DEFAULT '',
        "perfil" varchar(20) NOT NULL DEFAULT 'Consultor',
        "codigo_sicla" varchar(40) NOT NULL DEFAULT '',
        "ativo" boolean NOT NULL DEFAULT true,
        "criado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_usuarios_login" ON "usuarios" ("login");`,
    );

    await queryRunner.query(`
      CREATE TABLE "projetos" (
        "id" SERIAL PRIMARY KEY,
        "cliente" varchar(200) NOT NULL,
        "cnpj" varchar(40) NOT NULL DEFAULT '',
        "numero_projeto" varchar(40) NOT NULL DEFAULT '',
        "numero_proposta" varchar(40) NOT NULL DEFAULT '',
        "ramo" varchar(160) NOT NULL DEFAULT '',
        "responsavel" varchar(160) NOT NULL DEFAULT '',
        "consultor" varchar(160) NOT NULL DEFAULT '',
        "gci" varchar(160) NOT NULL DEFAULT '',
        "etapa" varchar(40) NOT NULL DEFAULT 'Agendamento',
        "situacao" varchar(40) NOT NULL DEFAULT 'Em andamento',
        "data_inicio" varchar(20) NOT NULL DEFAULT '',
        "data_levantamento" varchar(20) NOT NULL DEFAULT '',
        "data_uso_oficial" varchar(20) NOT NULL DEFAULT '',
        "data_encerramento" varchar(20) NOT NULL DEFAULT '',
        "horas_cobradas" varchar(20) NOT NULL DEFAULT '',
        "horas_bonificadas" varchar(20) NOT NULL DEFAULT '',
        "modulos" text NOT NULL DEFAULT '',
        "contato_nome" varchar(160) NOT NULL DEFAULT '',
        "contato_email" varchar(160) NOT NULL DEFAULT '',
        "contato_tel" varchar(60) NOT NULL DEFAULT '',
        "contatos" text NOT NULL DEFAULT '',
        "observacoes" text NOT NULL DEFAULT '',
        "criado_em" TIMESTAMP NOT NULL DEFAULT now(),
        "atualizado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" SERIAL PRIMARY KEY,
        "usuario_id" integer NOT NULL,
        "token_hash" varchar(128) NOT NULL,
        "expira_em" TIMESTAMP NOT NULL,
        "revogado" boolean NOT NULL DEFAULT false,
        "criado_em" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_usuario_id" ON "refresh_tokens" ("usuario_id");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens";`);
    await queryRunner.query(`DROP TABLE "projetos";`);
    await queryRunner.query(`DROP TABLE "usuarios";`);
  }
}
