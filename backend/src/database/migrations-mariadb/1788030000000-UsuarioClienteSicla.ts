import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vínculo do usuário com o CLIENTE no SICLA — base do acesso do cliente ao BI
 * "Implantação Clientes SIGER" (docs/acesso-cliente-bi.md).
 *
 * Duas coisas nascem aqui:
 *
 * 1. `usuarios.codigo_cliente_sicla` — o código do cliente (`SICLA.LISTA_CLIENTES.CODIGO`)
 *    que o usuário com papel `Cliente` pode enxergar. Vazio em todo usuário interno, e é
 *    esse o default: a coluna nasce sem efeito nenhum sobre quem já usa o Painel.
 *
 * 2. A liberação padrão do papel `Cliente` no menu `bi_implantacao`. Ela é INSERIDA aqui, e
 *    não deixada por conta do seed, porque `PermissoesService.seedFaltantes` semeia por
 *    par (papel, menu) desde 2026-08-31 — mas em produção esta é a primeira vez que um
 *    papel novo aparece depois de o menu já existir, e uma linha explícita na migration é o
 *    que garante o estado certo mesmo que o seed mude de critério depois.
 *
 * O `INSERT IGNORE` é idempotente por causa do índice único (papel, menu) da tabela: rodar
 * de novo não duplica, e não sobrescreve o nível se o Administrador já tiver configurado o
 * papel na tela. */
export class UsuarioClienteSicla1788030000000 implements MigrationInterface {
  name = 'UsuarioClienteSicla1788030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`usuarios\` ADD \`codigo_cliente_sicla\` varchar(200) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `INSERT IGNORE INTO \`permissoes_papel\` (\`papel\`, \`menu\`, \`nivel\`)
       VALUES ('Cliente', 'bi_implantacao', 'consulta')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`permissoes_papel\` WHERE \`papel\` = 'Cliente'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`usuarios\` DROP COLUMN \`codigo_cliente_sicla\``,
    );
  }
}
