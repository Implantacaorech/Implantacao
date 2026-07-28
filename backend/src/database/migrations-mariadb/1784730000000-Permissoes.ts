import { MigrationInterface, QueryRunner } from 'typeorm';

/** Painel de Permissões (Gestão): RBAC configurável no banco. `permissoes_papel` guarda o
 * nível (nada/consulta/alteracao) por papel × menu; `permissoes_usuario` as exceções por
 * usuário. O seed dos padrões (espelho das regras que estavam fixas no código) é feito no
 * boot por PermissoesService.seedSeVazio — aqui só a estrutura. */
export class Permissoes1784730000000 implements MigrationInterface {
  name = 'Permissoes1784730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`permissoes_papel\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`papel\` varchar(20) NOT NULL,
        \`menu\` varchar(40) NOT NULL,
        \`nivel\` varchar(12) NOT NULL DEFAULT 'nada',
        UNIQUE INDEX \`IDX_permissoes_papel_papel_menu\` (\`papel\`, \`menu\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`permissoes_usuario\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`usuario_id\` int NOT NULL,
        \`menu\` varchar(40) NOT NULL,
        \`nivel\` varchar(12) NOT NULL DEFAULT 'nada',
        INDEX \`IDX_permissoes_usuario_usuario\` (\`usuario_id\`),
        UNIQUE INDEX \`IDX_permissoes_usuario_usuario_menu\` (\`usuario_id\`, \`menu\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`permissoes_usuario\``);
    await queryRunner.query(`DROP TABLE \`permissoes_papel\``);
  }
}
