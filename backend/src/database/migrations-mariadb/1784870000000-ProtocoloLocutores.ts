import { MigrationInterface, QueryRunner } from 'typeorm';

/** Separação de locutores na transcrição ("quem falou quando").
 *
 * - `participantes`: quantas vozes separar. É INFORMADO, não descoberto — testado em
 *   2026-07-31 numa reunião real, o agrupamento automático inventou de 7 a 10 vozes onde
 *   havia 2; com o número fixo o corte saiu limpo. 0 = sem separação.
 * - `mapa_locutores`: JSON `{"P1":"Ivian"}`. O texto guarda o rótulo; o nome vive aqui, e
 *   renomear troca o mapa em vez de reescrever a transcrição (reversível).
 */
export class ProtocoloLocutores1784870000000 implements MigrationInterface {
  name = 'ProtocoloLocutores1784870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `protocolos` ADD `participantes` int NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      "ALTER TABLE `protocolos` ADD `mapa_locutores` text NOT NULL DEFAULT ''",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `protocolos` DROP COLUMN `mapa_locutores`',
    );
    await queryRunner.query(
      'ALTER TABLE `protocolos` DROP COLUMN `participantes`',
    );
  }
}
