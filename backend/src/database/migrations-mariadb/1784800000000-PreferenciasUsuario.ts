import { MigrationInterface, QueryRunner } from 'typeorm';

/** Preferências de tela por usuário logado — começa guardando a seleção de filtros de cada
 * tela do Painel (Capacidade da equipe, Carteira, BI, Matriz, Usuários…). Um registro por
 * usuário × chave de tela, com o estado dos filtros em JSON.
 *
 * Sem `FOREIGN KEY`, como todas as outras tabelas do schema (ver
 * `vault/05 - Banco de Dados`): a integridade referencial é da aplicação, não do banco. O
 * índice único em (`usuario_id`, `chave`) é o que importa aqui — é ele que faz o `upsert`
 * do serviço ser atômico. */
export class PreferenciasUsuario1784800000000 implements MigrationInterface {
  name = 'PreferenciasUsuario1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`preferencias_usuario\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`usuario_id\` int NOT NULL,
        \`chave\` varchar(60) NOT NULL,
        \`valor\` text NOT NULL,
        \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_preferencias_usuario_usuario_chave\` (\`usuario_id\`, \`chave\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`preferencias_usuario\``);
  }
}
