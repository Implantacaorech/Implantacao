import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vocabulário da gravação (nomes dos participantes, cliente, jargão) enviado ao Whisper
 * como `hotwords`. Fica no registro porque a retranscrição do arquivo acontece DEPOIS, no
 * encerramento, e precisa dos mesmos termos que o ao vivo usou. Ver
 * `backend/src/protocolos/vocabulario.ts`. */
export class ProtocoloVocabulario1784860000000 implements MigrationInterface {
  name = 'ProtocoloVocabulario1784860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `protocolos` ADD `vocabulario` text NOT NULL DEFAULT ''",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `protocolos` DROP COLUMN `vocabulario`',
    );
  }
}
