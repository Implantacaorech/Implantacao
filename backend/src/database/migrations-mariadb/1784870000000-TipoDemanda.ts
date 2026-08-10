import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tipo da demanda aberta pelo Comercial no passo 1: 'Levantamento' ou 'Demonstração'
 * (docs/processo-implantacao.md §2.1.1 — "Geração da demanda de levantamento / demonstração").
 * Passa a ser escolha OBRIGATÓRIA no cadastro do cliente; os projetos que já existiam ficam
 * com o valor vazio, sem chute retroativo. */
export class TipoDemanda1784870000000 implements MigrationInterface {
  name = 'TipoDemanda1784870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projetos\` ADD \`tipo_demanda\` varchar(20) NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projetos\` DROP COLUMN \`tipo_demanda\``,
    );
  }
}
