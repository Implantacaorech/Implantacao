import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabela `api_clientes` — clientes de MÁQUINA da API de Dados (`/api/dados/v1`).
 *
 * Nasce com a regra adotada em 2026-08-25 (ADR-0003): toda consulta a banco externo passa
 * por uma API, e essa API não é consumida só pelo Painel — outros sistemas da Rech,
 * agentes de IA e ferramentas de BI entram por aqui. Um JWT de pessoa não serve para isso
 * (expira em 15 min, carrega perfil/menus e some com o desligamento do usuário).
 *
 * A chave é entregue uma única vez no cadastro; o banco guarda só o hash bcrypt do segredo
 * e o prefixo em claro (índice de busca). Em dev/teste (SQLite) a tabela nasce por
 * `synchronize`; em produção (MariaDB), por esta migration.
 */
export class ApiClientes1787990000000 implements MigrationInterface {
  name = 'ApiClientes1787990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`api_clientes\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`nome\` varchar(160) NOT NULL DEFAULT '',
        \`prefixo\` varchar(24) NOT NULL DEFAULT '',
        \`chave_hash\` varchar(120) NOT NULL DEFAULT '',
        \`escopos\` text NOT NULL,
        \`ativo\` tinyint NOT NULL DEFAULT 1,
        \`observacao\` varchar(255) NOT NULL DEFAULT '',
        \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`ultimo_uso_em\` datetime NULL,
        UNIQUE INDEX \`IDX_api_clientes_prefixo\` (\`prefixo\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`api_clientes\``);
  }
}
