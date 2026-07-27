import { MigrationInterface, QueryRunner } from 'typeorm';

/** Detalhe dos módulos contratados marcados na consulta ao SICLA (passo 1). Guarda, por
 * item, a descrição e a observação — o campo `modulos` continua sendo só a lista de códigos
 * efetivos (do adicional quando há, senão do módulo), que os geradores leem. JSON em texto,
 * nulo para os projetos que já existiam. */
export class ModulosDetalhe1784700000000 implements MigrationInterface {
  name = 'ModulosDetalhe1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projetos\` ADD \`modulos_detalhe\` text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projetos\` DROP COLUMN \`modulos_detalhe\``,
    );
  }
}
