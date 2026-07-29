import { MigrationInterface, QueryRunner } from 'typeorm';

/** Inserção do passo 3 "Realizar o Levantamento de Processo" (2026-07-28): o que era 3..18
 * virou 4..19. Este passo migra os DADOS já gravados em `projeto_passos` para o novo mapa:
 *
 *  1. Desloca +1 todo passo concluído a partir do 3 (em ordem DECRESCENTE, para não colidir
 *     com o índice único (projeto_id, passo) durante o incremento).
 *  2. Preenche o novo passo 3 (concluído) nos projetos que já tinham avançado além dele —
 *     assim a sequência não fica com um "buraco" no meio. */
export class RenumerarLevantamento1784720000000 implements MigrationInterface {
  name = 'RenumerarLevantamento1784720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'UPDATE `projeto_passos` SET `passo` = `passo` + 1 WHERE `passo` >= 3 ORDER BY `passo` DESC',
    );
    await queryRunner.query(
      'INSERT INTO `projeto_passos` (`projeto_id`, `passo`, `concluido_por`, `conferido`, `observacao`) ' +
        "SELECT DISTINCT `projeto_id`, 3, 'sistema (renumeração)', 0, " +
        "'Passo inserido retroativamente na renumeração do processo (2026-07-28).' " +
        'FROM `projeto_passos` WHERE `passo` >= 4',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `projeto_passos` WHERE `passo` = 3 AND `concluido_por` = 'sistema (renumeração)'",
    );
    await queryRunner.query(
      'UPDATE `projeto_passos` SET `passo` = `passo` - 1 WHERE `passo` >= 4 ORDER BY `passo` ASC',
    );
  }
}
