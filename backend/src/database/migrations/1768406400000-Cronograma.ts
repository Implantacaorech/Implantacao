import { MigrationInterface, QueryRunner } from 'typeorm';

/** Schema do Agendador de Visitas (ChecklistModelo, Designacao, AtividadeCronograma,
 * SlotCronograma, CronogramaConfig, CronogramaPeriodoBloqueado) — escrito à mão pelo mesmo
 * motivo da migration inicial (sem Postgres acessível para `migration:generate` neste
 * ambiente de desenvolvimento; ver docs/migracao/03-documento-conversao.md). */
export class Cronograma1768406400000 implements MigrationInterface {
  name = 'Cronograma1768406400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "checklist_modelo" (
        "id" SERIAL PRIMARY KEY,
        "ordem" integer NOT NULL DEFAULT 0,
        "modulo" varchar(40) NOT NULL DEFAULT '',
        "adicional" varchar(40) NOT NULL DEFAULT '',
        "tipo" varchar(60) NOT NULL DEFAULT '',
        "integracoes" text NOT NULL DEFAULT '',
        "golive" varchar(20) NOT NULL DEFAULT '',
        "menu" varchar(60) NOT NULL DEFAULT '',
        "item" text NOT NULL DEFAULT '',
        "acao" text NOT NULL DEFAULT '',
        "seq" varchar(20) NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_checklist_modelo_ordem" ON "checklist_modelo" ("ordem");`,
    );

    await queryRunner.query(`
      CREATE TABLE "designacoes" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "modulo" varchar(80) NOT NULL DEFAULT '',
        "consultor" varchar(160) NOT NULL DEFAULT '',
        "ordem" integer NOT NULL DEFAULT 0,
        "nao_distribuir" boolean NOT NULL DEFAULT false,
        "analista" varchar(160) NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_designacoes_projeto_id" ON "designacoes" ("projeto_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "cronograma_atividades" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "modulo" varchar(40) NOT NULL DEFAULT '',
        "seq" integer NOT NULL DEFAULT 0,
        "ordem" integer NOT NULL DEFAULT 0,
        "descricao" text NOT NULL DEFAULT '',
        "tipo" varchar(60) NOT NULL DEFAULT '',
        "data" varchar(10) NOT NULL DEFAULT '',
        "turno" varchar(10) NOT NULL DEFAULT '',
        "tecnico" varchar(120) NOT NULL DEFAULT '',
        "status" varchar(20) NOT NULL DEFAULT 'Solicitada',
        "nova_data" varchar(10) NOT NULL DEFAULT '',
        "novo_turno" varchar(10) NOT NULL DEFAULT '',
        "origem_id" integer NOT NULL DEFAULT 0,
        "is_copia" boolean NOT NULL DEFAULT false,
        "auto_agendado" boolean NOT NULL DEFAULT false
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cronograma_atividades_projeto_id" ON "cronograma_atividades" ("projeto_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "cronograma_slots" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "data" varchar(10) NOT NULL DEFAULT '',
        "turno" varchar(10) NOT NULL DEFAULT '',
        "hora_inicio" varchar(5) NOT NULL DEFAULT '',
        "hora_fim" varchar(5) NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cronograma_slots_projeto_id" ON "cronograma_slots" ("projeto_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "cronograma_config" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "modo_disponibilidade" varchar(20) NOT NULL DEFAULT 'conjunta',
        "data_inicio" varchar(10) NOT NULL DEFAULT '',
        "dias_turnos_excluidos" varchar(200) NOT NULL DEFAULT '',
        "analista_padrao" varchar(160) NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cronograma_config_projeto_id" ON "cronograma_config" ("projeto_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "cronograma_periodos_bloqueados" (
        "id" SERIAL PRIMARY KEY,
        "projeto_id" integer NOT NULL,
        "data_ini" varchar(10) NOT NULL DEFAULT '',
        "data_fim" varchar(10) NOT NULL DEFAULT '',
        "motivo" varchar(160) NOT NULL DEFAULT '',
        "tecnicos" varchar(400) NOT NULL DEFAULT ''
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cronograma_periodos_bloqueados_projeto_id" ON "cronograma_periodos_bloqueados" ("projeto_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cronograma_periodos_bloqueados";`);
    await queryRunner.query(`DROP TABLE "cronograma_config";`);
    await queryRunner.query(`DROP TABLE "cronograma_slots";`);
    await queryRunner.query(`DROP TABLE "cronograma_atividades";`);
    await queryRunner.query(`DROP TABLE "designacoes";`);
    await queryRunner.query(`DROP TABLE "checklist_modelo";`);
  }
}
