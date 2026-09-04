import { MigrationInterface, QueryRunner } from 'typeorm';

/** Módulo **Controle de Atividades** — quadro de atividades por cliente
 * (docs/controle-atividades.md).
 *
 * Dez tabelas, todas novas, todas com prefixo `atividade_`. Nada de tabela existente é
 * alterado: esta migration só ACRESCENTA, e por isso é segura de rodar com o Painel no ar.
 *
 * Duas linhas merecem explicação:
 *
 * 1. `atividade_quadros.codigo_cliente_sicla` é ÚNICO. É o que torna a abertura de quadro
 *    idempotente mesmo em corrida — dois consultores clicando ao mesmo tempo no mesmo
 *    cliente não criam dois quadros.
 *
 * 2. As permissões do menu novo são inseridas AQUI, e não deixadas por conta do seed. O
 *    `PermissoesService.seedFaltantes` semeia por par (papel, menu), o que já resolveria —
 *    mas uma linha explícita garante o estado certo em produção mesmo que o critério do
 *    seed mude depois. `INSERT IGNORE` é idempotente pelo índice único (papel, menu) e não
 *    sobrescreve o que o Administrador já tiver configurado na tela.
 *
 * `ordem` é `double`, e não `decimal`: a ordenação por ponto médio precisa de número, e o
 * driver do MariaDB devolve DECIMAL como string. */
export class ControleAtividades1788060000000 implements MigrationInterface {
  name = 'ControleAtividades1788060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`atividade_quadros\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`codigo_cliente_sicla\` varchar(40) NOT NULL,
      \`nome_cliente\` varchar(200) NOT NULL DEFAULT '',
      \`projeto_id\` int NULL,
      \`arquivado\` tinyint NOT NULL DEFAULT 0,
      \`criado_por_usuario_id\` int NULL,
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE INDEX \`IDX_atividade_quadros_codigo\` (\`codigo_cliente_sicla\`),
      INDEX \`IDX_atividade_quadros_projeto\` (\`projeto_id\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_quadro_responsaveis\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`quadro_id\` int NOT NULL,
      \`usuario_id\` int NOT NULL,
      \`principal\` tinyint NOT NULL DEFAULT 0,
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      UNIQUE INDEX \`IDX_atv_resp_quadro_usuario\` (\`quadro_id\`, \`usuario_id\`),
      INDEX \`IDX_atv_resp_quadro\` (\`quadro_id\`),
      INDEX \`IDX_atv_resp_usuario\` (\`usuario_id\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_listas\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`quadro_id\` int NOT NULL,
      \`titulo\` varchar(80) NOT NULL,
      \`ordem\` double NOT NULL DEFAULT 0,
      \`visivel_cliente\` tinyint NOT NULL DEFAULT 0,
      \`arquivada\` tinyint NOT NULL DEFAULT 0,
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX \`IDX_atv_listas_quadro\` (\`quadro_id\`),
      INDEX \`IDX_atv_listas_quadro_ordem\` (\`quadro_id\`, \`ordem\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_cartoes\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`lista_id\` int NOT NULL,
      \`quadro_id\` int NOT NULL,
      \`titulo\` varchar(200) NOT NULL,
      \`descricao\` text NOT NULL,
      \`ordem\` double NOT NULL DEFAULT 0,
      \`visivel_cliente\` tinyint NOT NULL DEFAULT 0,
      \`origem\` varchar(20) NOT NULL DEFAULT 'consultor',
      \`etiquetas\` varchar(200) NOT NULL DEFAULT '',
      \`prazo\` varchar(20) NOT NULL DEFAULT '',
      \`concluido_em\` datetime NULL,
      \`projeto_id\` int NULL,
      \`criado_por_usuario_id\` int NULL,
      \`criado_por_nome\` varchar(160) NOT NULL DEFAULT '',
      \`arquivado\` tinyint NOT NULL DEFAULT 0,
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX \`IDX_atv_cartoes_lista\` (\`lista_id\`),
      INDEX \`IDX_atv_cartoes_quadro\` (\`quadro_id\`),
      INDEX \`IDX_atv_cartoes_lista_ordem\` (\`lista_id\`, \`ordem\`),
      INDEX \`IDX_atv_cartoes_quadro_vis\` (\`quadro_id\`, \`visivel_cliente\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_membros\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`cartao_id\` int NOT NULL,
      \`tipo\` varchar(20) NOT NULL,
      \`usuario_id\` int NULL,
      \`nome\` varchar(160) NOT NULL DEFAULT '',
      \`email\` varchar(200) NOT NULL DEFAULT '',
      \`cargo\` varchar(120) NOT NULL DEFAULT '',
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX \`IDX_atv_membros_cartao\` (\`cartao_id\`),
      INDEX \`IDX_atv_membros_cartao_tipo\` (\`cartao_id\`, \`tipo\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_checklist_itens\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`cartao_id\` int NOT NULL,
      \`texto\` varchar(300) NOT NULL,
      \`feito\` tinyint NOT NULL DEFAULT 0,
      \`ordem\` double NOT NULL DEFAULT 0,
      \`feito_por\` varchar(160) NOT NULL DEFAULT '',
      \`feito_em\` datetime NULL,
      INDEX \`IDX_atv_ck_cartao\` (\`cartao_id\`),
      INDEX \`IDX_atv_ck_cartao_ordem\` (\`cartao_id\`, \`ordem\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_anexos\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`cartao_id\` int NOT NULL,
      \`tipo\` varchar(20) NOT NULL DEFAULT 'arquivo',
      \`nome\` varchar(260) NOT NULL,
      \`arquivo\` varchar(300) NOT NULL DEFAULT '',
      \`url\` text NOT NULL,
      \`mime\` varchar(120) NOT NULL DEFAULT '',
      \`tamanho\` int NOT NULL DEFAULT 0,
      \`enviado_por\` varchar(160) NOT NULL DEFAULT '',
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX \`IDX_atv_anexos_cartao\` (\`cartao_id\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_comentarios\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`cartao_id\` int NOT NULL,
      \`autor_usuario_id\` int NULL,
      \`autor_nome\` varchar(160) NOT NULL DEFAULT '',
      \`autor_tipo\` varchar(20) NOT NULL DEFAULT 'interno',
      \`texto\` text NOT NULL,
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX \`IDX_atv_coment_cartao\` (\`cartao_id\`),
      INDEX \`IDX_atv_coment_cartao_data\` (\`cartao_id\`, \`criado_em\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_eventos\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`quadro_id\` int NOT NULL,
      \`cartao_id\` int NULL,
      \`tipo\` varchar(40) NOT NULL,
      \`detalhe\` text NOT NULL,
      \`autor_usuario_id\` int NULL,
      \`autor_nome\` varchar(160) NOT NULL DEFAULT '',
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX \`IDX_atv_eventos_quadro\` (\`quadro_id\`),
      INDEX \`IDX_atv_eventos_quadro_data\` (\`quadro_id\`, \`criado_em\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE \`atividade_notificacoes\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`usuario_id\` int NOT NULL,
      \`quadro_id\` int NOT NULL,
      \`cartao_id\` int NULL,
      \`codigo_cliente_sicla\` varchar(40) NOT NULL DEFAULT '',
      \`tipo\` varchar(20) NOT NULL,
      \`titulo\` varchar(200) NOT NULL DEFAULT '',
      \`texto\` text NOT NULL,
      \`lida\` tinyint NOT NULL DEFAULT 0,
      \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX \`IDX_atv_notif_usuario\` (\`usuario_id\`),
      INDEX \`IDX_atv_notif_usuario_lida\` (\`usuario_id\`, \`lida\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);

    await queryRunner.query(
      `INSERT IGNORE INTO \`permissoes_papel\` (\`papel\`, \`menu\`, \`nivel\`) VALUES
       ('ADM', 'controle_atividades', 'alteracao'),
       ('Coordenador', 'controle_atividades', 'alteracao'),
       ('Administrativo', 'controle_atividades', 'alteracao'),
       ('GCI', 'controle_atividades', 'alteracao'),
       ('Consultor', 'controle_atividades', 'alteracao'),
       ('Levantador', 'controle_atividades', 'alteracao'),
       ('Comercial', 'controle_atividades', 'consulta'),
       ('Cliente', 'controle_atividades', 'alteracao')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`permissoes_papel\` WHERE \`menu\` = 'controle_atividades'`,
    );
    await queryRunner.query(
      `DELETE FROM \`permissoes_usuario\` WHERE \`menu\` = 'controle_atividades'`,
    );
    for (const t of [
      'atividade_notificacoes',
      'atividade_eventos',
      'atividade_comentarios',
      'atividade_anexos',
      'atividade_checklist_itens',
      'atividade_membros',
      'atividade_cartoes',
      'atividade_listas',
      'atividade_quadro_responsaveis',
      'atividade_quadros',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
  }
}
