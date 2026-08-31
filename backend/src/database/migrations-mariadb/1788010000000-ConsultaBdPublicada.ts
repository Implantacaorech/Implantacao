import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Campos de PUBLICAÇÃO em `consultas_bd` — o que permite criar uma consulta da API de Dados
 * pela TELA, sem release (desenho das duas instâncias, decidido com o usuário em
 * 2026-08-25).
 *
 * Até aqui uma consulta salva era só texto de SQL para os Dashboards e para o "Testar". Para
 * virar uma consulta do CATÁLOGO — chamável por token, documentada, com contrato — faltava
 * declarar nome público, parâmetros, colunas de retorno e teto de linhas.
 *
 * Aditiva e conservadora: `publicada` nasce `false`, então **nada muda** para as 8 consultas
 * que já existem. Elas continuam servindo os Dashboards exatamente como antes, e só entram
 * no catálogo se alguém publicá-las na tela.
 */
export class ConsultaBdPublicada1788010000000 implements MigrationInterface {
  name = 'ConsultaBdPublicada1788010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `consultas_bd` ADD `nome_api` varchar(80) NOT NULL DEFAULT ''",
    );
    await queryRunner.query(
      'ALTER TABLE `consultas_bd` ADD `publicada` tinyint NOT NULL DEFAULT 0',
    );
    // `text` não aceita DEFAULT em MariaDB — a coluna nasce NULL e o service trata como ''.
    await queryRunner.query(
      'ALTER TABLE `consultas_bd` ADD `parametros` text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `consultas_bd` ADD `colunas` text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `consultas_bd` ADD `limite_linhas` int NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `consultas_bd` ADD `cache_segundos` int NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const coluna of [
      'cache_segundos',
      'limite_linhas',
      'colunas',
      'parametros',
      'publicada',
      'nome_api',
    ]) {
      await queryRunner.query(
        `ALTER TABLE \`consultas_bd\` DROP COLUMN \`${coluna}\``,
      );
    }
  }
}
