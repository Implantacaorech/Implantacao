import { MigrationInterface, QueryRunner } from 'typeorm';

/** As duas tabelas que a revisão do processo de 2026-07-30 pediu:
 *
 *   `destinatarios_passo` — para quem vai o e-mail de cada passo, editável em
 *      Sistema → Ferramentas. Nasce VAZIA: sem linha, vale o padrão do código
 *      (`EMAILS_POR_PASSO.para`). É por ela que entram os dois grupos de e-mail da Rech
 *      avisados no passo 1, que são listas internas e não cabem no código.
 *
 *   `emails_passo` — o e-mail que o Painel gerou em cada passo, guardado por inteiro
 *      (destinatários, assunto, corpo, anexo, status). A timeline já dizia QUE um e-mail
 *      saiu; esta tabela é o que permite RELER o que foi mandado, que é a consulta exigida
 *      pelo processo — qualquer pessoa com acesso ao menu precisa poder ver os e-mails de
 *      cada etapa.
 *
 * Sem `FOREIGN KEY`, como o resto do schema (ver `vault/05 - Banco de Dados`): a integridade
 * referencial é da aplicação. */
export class EmailsEDestinatariosPorPasso1784820000000 implements MigrationInterface {
  name = 'EmailsEDestinatariosPorPasso1784820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`destinatarios_passo\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`passo\` int NOT NULL,
        \`grupos\` text NOT NULL,
        \`extras\` text NOT NULL,
        \`ativo\` tinyint NOT NULL DEFAULT 1,
        \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_destinatarios_passo_passo\` (\`passo\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`emails_passo\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`projeto_id\` int NOT NULL,
        \`passo\` int NOT NULL,
        \`para\` text NOT NULL,
        \`assunto\` varchar(300) NOT NULL DEFAULT '',
        \`corpo\` text NOT NULL,
        \`anexo\` varchar(255) NOT NULL DEFAULT '',
        \`status\` varchar(20) NOT NULL DEFAULT 'enviado',
        \`erro\` text NOT NULL,
        \`autor\` varchar(160) NOT NULL DEFAULT '',
        \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_emails_passo_projeto\` (\`projeto_id\`),
        INDEX \`IDX_emails_passo_passo\` (\`passo\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`emails_passo\``);
    await queryRunner.query(`DROP TABLE \`destinatarios_passo\``);
  }
}
