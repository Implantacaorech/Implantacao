import { MigrationInterface, QueryRunner } from 'typeorm';

/** Código do cliente no SICLA no protocolo. A gravação de reunião escolhe o cliente pela
 * MESMA busca do passo 1 (SICLA, `clientes-sicla/buscar`) — e não pela carteira de projetos
 * do painel: a reunião pode acontecer antes de a ficha do projeto existir. `projeto_id`
 * continua sendo preenchido quando dá para amarrar (veio de uma tela de projeto, ou existe
 * projeto com o mesmo CNPJ). */
export class ProtocoloClienteSicla1784850000000 implements MigrationInterface {
  name = 'ProtocoloClienteSicla1784850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `protocolos` ADD `cliente_codigo` varchar(20) NOT NULL DEFAULT ''",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `protocolos` DROP COLUMN `cliente_codigo`',
    );
  }
}
