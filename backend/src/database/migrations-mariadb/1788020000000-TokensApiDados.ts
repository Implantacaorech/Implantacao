import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `api_dados_tokens` — os tokens com que o **Portal Implantação** consulta o **Portal API**
 * (ajuste pedido pelo usuário em 2026-08-25: "preciso que tenha a tela onde eu insira os
 * TOKENS gerados").
 *
 * É o espelho de `api_clientes`, com uma diferença que importa: lá a chave é guardada só
 * como hash (basta conferir a que chega); aqui ela é guardada inteira, porque este lado
 * precisa enviá-la a cada consulta. O que vaza numa invasão à instância publicada é este
 * token — que vale exatamente as consultas listadas — e não a credencial do banco, que
 * nunca sai da rede interna.
 *
 * Tabela nova e vazia: enquanto ninguém cadastrar um token, o Painel continua consultando o
 * banco direto, exatamente como hoje. Cadastrar o primeiro é o que vira a chave, e só para
 * as consultas que ele autoriza.
 */
export class TokensApiDados1788020000000 implements MigrationInterface {
  name = 'TokensApiDados1788020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`api_dados_tokens\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`nome\` varchar(160) NOT NULL DEFAULT '',
        \`url\` varchar(300) NOT NULL DEFAULT '',
        \`chave\` text NOT NULL,
        \`consultas\` text NOT NULL,
        \`ativo\` tinyint NOT NULL DEFAULT 1,
        \`observacao\` varchar(255) NOT NULL DEFAULT '',
        \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`ultimo_uso_em\` datetime NULL,
        \`ultimo_erro\` text NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `api_dados_tokens`');
  }
}
