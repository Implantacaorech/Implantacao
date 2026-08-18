import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabelas do módulo **Consulta Wall-e** (`walle_chats`, `walle_arquivos`, `walle_entidades`) —
 * o índice PESQUISÁVEL do acervo documental dos chats do bot Wall-e.
 *
 * A fonte (`R:\GRM\CHAT_WALLE\`) é oficial e SOMENTE LEITURA (regra inegociável do usuário,
 * 2026-08-18): todo derivado — texto extraído, título, resumo, assuntos, entidades e o
 * controle incremental por hash — vive AQUI, no banco do Painel, nunca na fonte.
 *
 * `walle_arquivos.conteudo` e `resumo`/`assuntos` são LONGTEXT/TEXT de propósito: a lição do
 * `dicionario_documentos.conteudo` (migration 1784900000000) foi que TEXT de 64 KB estoura
 * com documento real; o acervo tem análises de 20 KB hoje e vai crescer.
 *
 * Em dev/teste (SQLite) as tabelas nascem por `synchronize`; em produção (MariaDB,
 * synchronize: false) precisam desta migration.
 */
export class Walle1787011200000 implements MigrationInterface {
  name = 'Walle1787011200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`walle_chats\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`codigo\` int NOT NULL,
        \`descricao\` varchar(256) NOT NULL DEFAULT '',
        \`tecnico\` varchar(120) NOT NULL DEFAULT '',
        \`sistema\` varchar(120) NOT NULL DEFAULT '',
        \`origem_metadados\` varchar(10) NOT NULL DEFAULT 'acervo',
        \`total_arquivos\` int NOT NULL DEFAULT 0,
        \`ultimo_arquivo_em\` datetime NULL,
        \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_walle_chats_codigo\` (\`codigo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`walle_arquivos\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`caminho_relativo\` varchar(400) NOT NULL,
        \`chat_codigo\` int NOT NULL,
        \`nome\` varchar(255) NOT NULL,
        \`extensao\` varchar(16) NOT NULL DEFAULT '',
        \`categoria\` varchar(30) NOT NULL DEFAULT 'outro',
        \`origem\` varchar(15) NOT NULL DEFAULT 'indeterminado',
        \`titulo\` varchar(300) NOT NULL DEFAULT '',
        \`resumo\` text NOT NULL,
        \`conteudo\` longtext NOT NULL,
        \`assuntos\` text NOT NULL,
        \`tamanho_bytes\` int NOT NULL DEFAULT 0,
        \`modificado_em\` datetime NULL,
        \`hash_conteudo\` varchar(64) NOT NULL DEFAULT '',
        \`removido\` tinyint NOT NULL DEFAULT 0,
        \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_walle_arquivos_caminho\` (\`caminho_relativo\`),
        INDEX \`IDX_walle_arquivos_chat\` (\`chat_codigo\`),
        INDEX \`IDX_walle_arquivos_categoria\` (\`categoria\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`walle_entidades\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`arquivo_id\` int NOT NULL,
        \`chat_codigo\` int NOT NULL,
        \`tipo\` varchar(20) NOT NULL,
        \`valor\` varchar(200) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_walle_entidades_unica\` (\`arquivo_id\`, \`tipo\`, \`valor\`),
        INDEX \`IDX_walle_entidades_chat\` (\`chat_codigo\`),
        INDEX \`IDX_walle_entidades_tipo\` (\`tipo\`),
        INDEX \`IDX_walle_entidades_valor\` (\`valor\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`walle_entidades\``);
    await queryRunner.query(`DROP TABLE \`walle_arquivos\``);
    await queryRunner.query(`DROP TABLE \`walle_chats\``);
  }
}
