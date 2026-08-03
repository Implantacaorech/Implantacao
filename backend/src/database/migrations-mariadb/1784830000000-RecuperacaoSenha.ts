import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tabela do fluxo "Esqueci minha senha" da tela de login: um registro por pedido em
 * aberto, com o código de 6 dígitos guardado em hash bcrypt e uma janela de 15 minutos.
 *
 * Sem `FOREIGN KEY` para `usuarios`, como o resto do schema (ver `vault/05 - Banco de
 * Dados`) — a integridade referencial é da aplicação. Os índices em `usuario_id` e `email`
 * são de busca: todo acesso à tabela entra por um dos dois. */
export class RecuperacaoSenha1784830000000 implements MigrationInterface {
  name = 'RecuperacaoSenha1784830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`recuperacoes_senha\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`usuario_id\` int NOT NULL,
        \`email\` varchar(160) NOT NULL DEFAULT '',
        \`codigo_hash\` text NOT NULL,
        \`tentativas\` int NOT NULL DEFAULT 0,
        \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_recuperacoes_senha_usuario\` (\`usuario_id\`),
        INDEX \`IDX_recuperacoes_senha_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`recuperacoes_senha\``);
  }
}
