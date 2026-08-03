import { MigrationInterface, QueryRunner } from 'typeorm';

/** Gravação de reunião ao vivo (menu Transcrição Áudio/Vídeo): o protocolo passa a poder
 * ser direcionado a um cliente/projeto. `projeto_id` é só um ponteiro (sem FK de
 * propósito — excluir um projeto não pode apagar conhecimento já registrado) e `cliente`
 * guarda o nome no momento do registro, que é o que a lista filtra e exibe.
 *
 * Não há coluna nova para o novo status ('Gravando') nem para a nova origem ('gravacao'):
 * `status` e `video_origem` já são varchar livres. */
export class ProtocoloGravacaoAoVivo1784840000000 implements MigrationInterface {
  name = 'ProtocoloGravacaoAoVivo1784840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `protocolos` ADD `projeto_id` int NULL',
    );
    await queryRunner.query(
      "ALTER TABLE `protocolos` ADD `cliente` varchar(200) NOT NULL DEFAULT ''",
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_protocolos_projeto_id` ON `protocolos` (`projeto_id`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `IDX_protocolos_projeto_id` ON `protocolos`',
    );
    await queryRunner.query('ALTER TABLE `protocolos` DROP COLUMN `cliente`');
    await queryRunner.query(
      'ALTER TABLE `protocolos` DROP COLUMN `projeto_id`',
    );
  }
}
