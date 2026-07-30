import { MigrationInterface, QueryRunner } from 'typeorm';

/** Resumo COMPLETO da transcrição (registro de atividades por menu + definições de
 * configuração), que passou a ocupar na tela de revisão o lugar da leitura da transcrição
 * bruta. Registros antigos ficam com a coluna vazia; basta reprocessar o protocolo (a
 * transcrição já feita é aproveitada) para preenchê-la. */
export class ProtocoloResumoCompleto1784790000000 implements MigrationInterface {
  name = 'ProtocoloResumoCompleto1784790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `protocolos` ADD `resumo_completo` text NOT NULL DEFAULT ''",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `protocolos` DROP COLUMN `resumo_completo`',
    );
  }
}
