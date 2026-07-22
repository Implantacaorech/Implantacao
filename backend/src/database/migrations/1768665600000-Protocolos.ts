import { MigrationInterface, QueryRunner } from 'typeorm';

/** Protocolos de Treinamento (vídeo -> transcrição local via faster-whisper no docservice
 * -> análise IA -> revisão/aprovação humana) — base de conhecimento própria, sem vínculo
 * com Projeto. Escrito à mão pelo mesmo motivo das migrations anteriores (sem Postgres
 * acessível para `migration:generate`). */
export class Protocolos1768665600000 implements MigrationInterface {
  name = 'Protocolos1768665600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "protocolos" (
        "id" SERIAL PRIMARY KEY,
        "titulo" varchar(255) NOT NULL DEFAULT '',
        "modulo" varchar(60) NOT NULL DEFAULT 'Módulo a validar',
        "menu" varchar(120) NOT NULL DEFAULT 'Menu não identificado - revisar manualmente',
        "assunto" varchar(255) NOT NULL DEFAULT '',
        "resumo" text NOT NULL DEFAULT '',
        "objetivo" text NOT NULL DEFAULT '',
        "quando_utilizar" text NOT NULL DEFAULT '',
        "pre_requisitos" text NOT NULL DEFAULT '',
        "passo_a_passo" text NOT NULL DEFAULT '',
        "configuracoes" text NOT NULL DEFAULT '',
        "dependencias" text NOT NULL DEFAULT '',
        "regras_negocio" text NOT NULL DEFAULT '',
        "pontos_atencao" text NOT NULL DEFAULT '',
        "exemplos" text NOT NULL DEFAULT '',
        "assuntos_removidos" text NOT NULL DEFAULT '',
        "pendencias" text NOT NULL DEFAULT '',
        "video_nome" varchar(255) NOT NULL DEFAULT '',
        "video_caminho" text NOT NULL DEFAULT '',
        "video_origem" varchar(20) NOT NULL DEFAULT 'sharepoint',
        "video_hash" varchar(40) NOT NULL DEFAULT '',
        "duracao_seg" integer NOT NULL DEFAULT 0,
        "transcricao" text NOT NULL DEFAULT '',
        "texto_ia" text NOT NULL DEFAULT '',
        "status" varchar(30) NOT NULL DEFAULT 'Pendente',
        "log_erro" text NOT NULL DEFAULT '',
        "historico" text NOT NULL DEFAULT '',
        "responsavel" varchar(120) NOT NULL DEFAULT '',
        "aprovador" varchar(120) NOT NULL DEFAULT '',
        "criado_em" TIMESTAMP NOT NULL DEFAULT now(),
        "processado_em" TIMESTAMP,
        "aprovado_em" TIMESTAMP
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_protocolos_video_hash" ON "protocolos" ("video_hash");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "protocolos";`);
  }
}
