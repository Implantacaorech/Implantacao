import { MigrationInterface, QueryRunner } from 'typeorm';

/** E-mail do Comercial que abriu o cliente. É o destinatário do passo 3 do processo — o
 * levantador repassa a ele o que encontrou no levantamento — e não havia campo nenhum para
 * isso. Preenchido automaticamente com o remetente do e-mail de fechamento (passo 1). */
export class ComercialEmail1784650800000 implements MigrationInterface {
  name = 'ComercialEmail1784650800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projetos\` ADD \`comercial_email\` varchar(160) NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projetos\` DROP COLUMN \`comercial_email\``,
    );
  }
}
