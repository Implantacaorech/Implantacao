import { MigrationInterface, QueryRunner } from 'typeorm';

/** Conversões de dados estimadas no passo 1 (Comercial). Guarda, por item, o nome e a
 * estimativa de horas — lista fixa (clientes/fornecedores, produtos, financeiro em aberto,
 * notas emitidas) mais itens livres. JSON em texto, nulo para os projetos que já existiam. */
export class Conversoes1784710000000 implements MigrationInterface {
  name = 'Conversoes1784710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projetos\` ADD \`conversoes\` text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projetos\` DROP COLUMN \`conversoes\``,
    );
  }
}
