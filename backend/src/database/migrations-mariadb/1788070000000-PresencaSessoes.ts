import { MigrationInterface, QueryRunner } from 'typeorm';

/** Controle de acessos — presença ao vivo (docs/controle-acessos.md).
 *
 * Uma tabela só, nova, sem tocar em nada existente: é segura de rodar com o Painel no ar.
 *
 * `ultimo_ping` tem índice próprio porque TODA leitura da tela filtra por ele
 * (`ultimo_ping >= agora - janela`) e a poda apaga por ele — sem o índice, cada consulta
 * varreria a tabela inteira.
 *
 * O índice único em (usuario_id, sessao) é o que torna a batida idempotente: a mesma aba
 * atualiza a própria linha em vez de acumular uma por batida. Sem ele, um usuário sozinho
 * geraria 80 linhas por hora. */
export class PresencaSessoes1788070000000 implements MigrationInterface {
  name = 'PresencaSessoes1788070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`presenca_sessoes\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`usuario_id\` int NOT NULL,
      \`sessao\` varchar(64) NOT NULL,
      \`nome\` varchar(160) NOT NULL DEFAULT '',
      \`perfil\` varchar(40) NOT NULL DEFAULT '',
      \`rota\` varchar(300) NOT NULL DEFAULT '',
      \`titulo\` varchar(160) NOT NULL DEFAULT '',
      \`visivel\` tinyint NOT NULL DEFAULT 1,
      \`ip\` varchar(60) NOT NULL DEFAULT '',
      \`navegador\` varchar(200) NOT NULL DEFAULT '',
      \`iniciado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`ultimo_ping\` datetime NOT NULL,
      UNIQUE INDEX \`IDX_presenca_usuario_sessao\` (\`usuario_id\`, \`sessao\`),
      INDEX \`IDX_presenca_usuario\` (\`usuario_id\`),
      INDEX \`IDX_presenca_ultimo_ping\` (\`ultimo_ping\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`presenca_sessoes\``);
  }
}
