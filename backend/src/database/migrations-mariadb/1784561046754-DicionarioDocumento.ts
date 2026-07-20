import { MigrationInterface, QueryRunner } from 'typeorm';

export class DicionarioDocumento1784561046754 implements MigrationInterface {
  name = 'DicionarioDocumento1784561046754';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove a tabela experimental `siger_fontes` (feature "Base SIGER", descontinuada e
    // substituída por este Dicionário). Só tinha dado de teste; IF EXISTS torna a
    // migration idempotente em bancos que nunca a criaram (ex.: SQLite dos testes).
    await queryRunner.query(`DROP TABLE IF EXISTS \`siger_fontes\``);
    await queryRunner.query(
      `CREATE TABLE \`dicionario_documentos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`slug\` varchar(160) NOT NULL, \`tipo\` varchar(20) NOT NULL, \`sigla\` varchar(20) NOT NULL, \`titulo\` varchar(255) NOT NULL, \`resumo\` text NOT NULL DEFAULT '', \`conteudo\` text NOT NULL, \`palavrasChave\` text NOT NULL DEFAULT '', \`caminho_origem\` varchar(500) NOT NULL, \`url_origem\` varchar(500) NOT NULL DEFAULT '', \`hash_conteudo\` varchar(64) NOT NULL, \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_3f18751ba265053c166431216c\` (\`slug\`), INDEX \`IDX_fb343062ddfe5b1c03351ad876\` (\`tipo\`), INDEX \`IDX_fbd3cd34d1603109292dbde8d9\` (\`sigla\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_fbd3cd34d1603109292dbde8d9\` ON \`dicionario_documentos\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_fb343062ddfe5b1c03351ad876\` ON \`dicionario_documentos\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_3f18751ba265053c166431216c\` ON \`dicionario_documentos\``,
    );
    await queryRunner.query(`DROP TABLE \`dicionario_documentos\``);
    // Reverte recriando a `siger_fontes` como estava (feature "Base SIGER").
    await queryRunner.query(
      `CREATE TABLE \`siger_fontes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`caminho\` varchar(500) NOT NULL, \`extensao\` varchar(20) NOT NULL, \`pasta_raiz\` varchar(255) NOT NULL, \`tamanho_bytes\` int NOT NULL, \`modificado_em\` datetime NOT NULL, \`hash_sha256\` varchar(64) NOT NULL, \`conteudo\` text NULL, \`indexado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_33caecbf17ef3bfc28f5ccc24e\` (\`caminho\`), INDEX \`IDX_d7d89ad3d5dd5978ecf0806422\` (\`extensao\`), INDEX \`IDX_01c4b30c1949c2582fc34409f0\` (\`pasta_raiz\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }
}
