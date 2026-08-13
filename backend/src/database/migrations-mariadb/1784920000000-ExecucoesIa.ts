import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabela `execucoes_ia` — telemetria de custo/tokens (A9) e trilha de auditoria (A10) de cada
 * chamada de IA do produto. Guarda só METADADOS (finalidade, provedor, modelo, tokens, custo,
 * quem/quando), nunca o conteúdo do prompt/resposta (LGPD).
 *
 * Em dev/teste (SQLite) a tabela nasce por `synchronize`; em produção (MariaDB, synchronize:
 * false) precisa desta migration.
 */
export class ExecucoesIa1784920000000 implements MigrationInterface {
  name = 'ExecucoesIa1784920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`execucoes_ia\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`finalidade\` varchar(20) NOT NULL,
        \`provider\` varchar(20) NOT NULL,
        \`modelo\` varchar(120) NOT NULL DEFAULT '',
        \`solicitante\` varchar(120) NULL,
        \`contexto\` varchar(160) NOT NULL DEFAULT '',
        \`tokens_entrada\` int NULL,
        \`tokens_saida\` int NULL,
        \`custo_usd\` float NULL,
        \`duracao_ms\` int NOT NULL DEFAULT 0,
        \`status\` varchar(10) NOT NULL DEFAULT 'ok',
        \`erro\` varchar(400) NULL,
        \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_execucoes_ia_finalidade\` (\`finalidade\`),
        INDEX \`IDX_execucoes_ia_criado_em\` (\`criado_em\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`execucoes_ia\``);
  }
}
