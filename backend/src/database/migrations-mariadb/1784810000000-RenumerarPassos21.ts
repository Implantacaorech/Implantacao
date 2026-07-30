import { MigrationInterface, QueryRunner } from 'typeorm';

/** Revisão do processo de 2026-07-30: de 19 para 21 passos, com dois passos NOVOS no meio —
 * o 5 ("Avançar para finalização da negociação", do Comercial) e o 12 ("Sinalizar Projeto
 * assinado", do Administrativo).
 *
 * De/para aplicado aos passos já gravados:
 *   1..4  → iguais
 *   5..10 → +1  (viram 6..11)
 *   11..19 → +2 (viram 13..21)
 *
 * A ordem das duas faixas importa: o bloco de cima (+2) sai primeiro, liberando o número 11
 * antes de o bloco de baixo (+1) chegar nele. Dentro de cada UPDATE, `ORDER BY passo DESC`
 * evita colidir com o índice único (projeto_id, passo) durante o incremento — mesmo cuidado
 * da migration `RenumerarLevantamento`.
 *
 * Backfill dos passos novos (só onde o processo REALMENTE já passou por eles):
 *   passo 5  — a cadeia 4→5→6 é estritamente sequencial, então todo projeto que já concluiu
 *              o 6 necessariamente passou pela negociação. Sem isto ficaria um buraco no meio.
 *   passo 12 — nada depende dele, então NÃO se preenche por dependência. Só recebe backfill
 *              quem já está no Encerramento (passo ≥ 17): aí o Projeto foi comprovadamente
 *              assinado. Projeto ainda na trilha do Projeto fica com o 12 PENDENTE, que é
 *              exatamente a ação nova que o Administrativo passa a ter de registrar.
 *
 * Acrescenta também `marcado`/`data_marcada`, que os passos 7 e 12 usam para registrar a
 * assinatura (do contrato e do Projeto) e a data em que ela aconteceu. */
export class RenumerarPassos211784810000000 implements MigrationInterface {
  name = 'RenumerarPassos211784810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'UPDATE `projeto_passos` SET `passo` = `passo` + 2 WHERE `passo` >= 11 ORDER BY `passo` DESC',
    );
    await queryRunner.query(
      'UPDATE `projeto_passos` SET `passo` = `passo` + 1 WHERE `passo` BETWEEN 5 AND 10 ORDER BY `passo` DESC',
    );

    // Documentos do anexo de e-mail do Outlook seguem a numeração do passo no `tipo`
    // (`email_passo_N`). O 4 continua 4; o antigo 5 vira 6.
    await queryRunner.query(
      "UPDATE `documentos` SET `tipo` = 'email_passo_6' WHERE `tipo` = 'email_passo_5'",
    );

    await queryRunner.query(
      'ALTER TABLE `projeto_passos` ADD `marcado` tinyint NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      "ALTER TABLE `projeto_passos` ADD `data_marcada` varchar(10) NOT NULL DEFAULT ''",
    );

    await queryRunner.query(
      'INSERT INTO `projeto_passos` (`projeto_id`, `passo`, `concluido_por`, `conferido`, `marcado`, `data_marcada`, `observacao`) ' +
        "SELECT DISTINCT `projeto_id`, 5, 'sistema (renumeração)', 0, 0, '', " +
        "'Passo inserido retroativamente na revisão do processo (2026-07-30).' " +
        'FROM `projeto_passos` WHERE `passo` >= 6',
    );
    await queryRunner.query(
      'INSERT INTO `projeto_passos` (`projeto_id`, `passo`, `concluido_por`, `conferido`, `marcado`, `data_marcada`, `observacao`) ' +
        "SELECT DISTINCT `projeto_id`, 12, 'sistema (renumeração)', 0, 0, '', " +
        "'Passo inserido retroativamente na revisão do processo (2026-07-30) — projeto já no Encerramento.' " +
        'FROM `projeto_passos` WHERE `passo` >= 17',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `projeto_passos` WHERE `passo` IN (5, 12) AND `concluido_por` = 'sistema (renumeração)'",
    );
    await queryRunner.query(
      'ALTER TABLE `projeto_passos` DROP COLUMN `data_marcada`',
    );
    await queryRunner.query(
      'ALTER TABLE `projeto_passos` DROP COLUMN `marcado`',
    );
    await queryRunner.query(
      "UPDATE `documentos` SET `tipo` = 'email_passo_5' WHERE `tipo` = 'email_passo_6'",
    );
    await queryRunner.query(
      'UPDATE `projeto_passos` SET `passo` = `passo` - 1 WHERE `passo` BETWEEN 6 AND 11 ORDER BY `passo` ASC',
    );
    await queryRunner.query(
      'UPDATE `projeto_passos` SET `passo` = `passo` - 2 WHERE `passo` >= 13 ORDER BY `passo` ASC',
    );
  }
}
