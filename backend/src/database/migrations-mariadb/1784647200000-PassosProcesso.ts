import { MigrationInterface, QueryRunner } from 'typeorm';

/** Estruturas do processo revisado em 2026-07-22 (os 18 passos operacionais):
 *
 *   `projeto_pessoas` — vínculo pessoa×projeto×papel. Existe porque um projeto pode ter MAIS
 *     DE UM levantador e MAIS DE UM consultor. O GCI continua em `projetos.gci` (é único).
 *   `projeto_rns`     — RNI/COB/Conversão. É tabela porque a quantidade é variável: o
 *     Administrativo acrescenta quantos registros o cliente exigir.
 *   `projeto_passos`  — conclusão de cada um dos 18 passos. Só há linha para passo
 *     CONCLUÍDO; a ausência é o pendente.
 *
 * Nada é destrutivo: `projetos.consultor` e `projetos.gci` seguem existindo e sendo
 * preenchidos, para não quebrar telas, filtros e documentos que já os leem.
 */
export class PassosProcesso1784647200000 implements MigrationInterface {
  name = 'PassosProcesso1784647200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`projeto_pessoas\` (` +
        `\`id\` int NOT NULL AUTO_INCREMENT, ` +
        `\`projeto_id\` int NOT NULL, ` +
        `\`pessoa\` varchar(160) NOT NULL, ` +
        `\`papel\` varchar(20) NOT NULL, ` +
        `\`criado_em\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ` +
        `INDEX \`IDX_projeto_pessoas_projeto\` (\`projeto_id\`), ` +
        `INDEX \`IDX_projeto_pessoas_projeto_papel\` (\`projeto_id\`, \`papel\`), ` +
        `PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`projeto_rns\` (` +
        `\`id\` int NOT NULL AUTO_INCREMENT, ` +
        `\`projeto_id\` int NOT NULL, ` +
        `\`tipo\` varchar(20) NOT NULL, ` +
        `\`numero\` varchar(40) NOT NULL DEFAULT '', ` +
        `\`descricao\` text NOT NULL, ` +
        `\`situacao\` varchar(60) NOT NULL DEFAULT '', ` +
        `\`criado_em\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ` +
        `INDEX \`IDX_projeto_rns_projeto\` (\`projeto_id\`), ` +
        `INDEX \`IDX_projeto_rns_projeto_tipo\` (\`projeto_id\`, \`tipo\`), ` +
        `PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // UNIQUE(projeto, passo): um passo só pode ser concluído uma vez por projeto. É a
    // garantia no BANCO de que não há conclusão duplicada, além da checagem no serviço.
    await queryRunner.query(
      `CREATE TABLE \`projeto_passos\` (` +
        `\`id\` int NOT NULL AUTO_INCREMENT, ` +
        `\`projeto_id\` int NOT NULL, ` +
        `\`passo\` int NOT NULL, ` +
        `\`concluido_em\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ` +
        `\`concluido_por\` varchar(160) NOT NULL DEFAULT '', ` +
        `\`conferido\` tinyint NOT NULL DEFAULT 0, ` +
        `\`observacao\` text NOT NULL, ` +
        `INDEX \`IDX_projeto_passos_projeto\` (\`projeto_id\`), ` +
        `UNIQUE INDEX \`IDX_projeto_passos_projeto_passo\` (\`projeto_id\`, \`passo\`), ` +
        `PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`projeto_passos\``);
    await queryRunner.query(`DROP TABLE \`projeto_rns\``);
    await queryRunner.query(`DROP TABLE \`projeto_pessoas\``);
  }
}
