import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgenteExecucao1784513666449 implements MigrationInterface {
  name = 'AgenteExecucao1784513666449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`agente_execucoes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`agente\` varchar(60) NOT NULL, \`agente_pai_id\` int NULL, \`tarefa\` varchar(255) NOT NULL DEFAULT '', \`status\` varchar(20) NOT NULL DEFAULT 'em_execucao', \`resultado\` text NULL, \`iniciado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`concluido_em\` datetime NULL, INDEX \`IDX_9b02190f8e3bc495a05f3f6a80\` (\`agente\`), INDEX \`IDX_8a3aed0866ac60c798b5278129\` (\`agente_pai_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_8a3aed0866ac60c798b5278129\` ON \`agente_execucoes\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_9b02190f8e3bc495a05f3f6a80\` ON \`agente_execucoes\``,
    );
    await queryRunner.query(`DROP TABLE \`agente_execucoes\``);
  }
}
