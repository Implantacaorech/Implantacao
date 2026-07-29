import { MigrationInterface, QueryRunner } from 'typeorm';

/** Levantamento a várias mãos: flag "Não será utilizado." por pergunta + colunas de
 * concorrência otimista (versao/atualizado_por/atualizado_em) que permitem dois técnicos
 * preenchendo a mesma tela, cada um no seu computador, sem um sobrescrever o outro. */
export class LevantamentoColaborativo1784750000000 implements MigrationInterface {
  name = 'LevantamentoColaborativo1784750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`levantamento_respostas\` ADD \`nao_utilizado\` tinyint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`levantamento_respostas\` ADD \`versao\` int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`levantamento_respostas\` ADD \`atualizado_por\` varchar(120) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE \`levantamento_respostas\` ADD \`atualizado_em\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`levantamento_respostas\` DROP COLUMN \`atualizado_em\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`levantamento_respostas\` DROP COLUMN \`atualizado_por\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`levantamento_respostas\` DROP COLUMN \`versao\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`levantamento_respostas\` DROP COLUMN \`nao_utilizado\``,
    );
  }
}
