import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMariaDb1784307346460 implements MigrationInterface {
  name = 'InitialMariaDb1784307346460';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`usuarios\` (\`id\` int NOT NULL AUTO_INCREMENT, \`login\` varchar(120) NOT NULL, \`nome\` varchar(120) NOT NULL DEFAULT '', \`email\` varchar(160) NOT NULL DEFAULT '', \`senha_hash\` text NOT NULL DEFAULT '', \`perfil\` varchar(20) NOT NULL DEFAULT 'Consultor', \`codigo_sicla\` varchar(40) NOT NULL DEFAULT '', \`ativo\` tinyint NOT NULL DEFAULT 1, \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_0c0fcf4a8c228628476a29ea30\` (\`login\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`projetos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`cliente\` varchar(200) NOT NULL, \`cnpj\` varchar(40) NOT NULL DEFAULT '', \`numero_projeto\` varchar(40) NOT NULL DEFAULT '', \`numero_proposta\` varchar(40) NOT NULL DEFAULT '', \`ramo\` varchar(160) NOT NULL DEFAULT '', \`responsavel\` varchar(160) NOT NULL DEFAULT '', \`consultor\` varchar(160) NOT NULL DEFAULT '', \`gci\` varchar(160) NOT NULL DEFAULT '', \`etapa\` varchar(40) NOT NULL DEFAULT 'Agendamento', \`situacao\` varchar(40) NOT NULL DEFAULT 'Em andamento', \`data_inicio\` varchar(20) NOT NULL DEFAULT '', \`data_levantamento\` varchar(20) NOT NULL DEFAULT '', \`data_uso_oficial\` varchar(20) NOT NULL DEFAULT '', \`data_encerramento\` varchar(20) NOT NULL DEFAULT '', \`horas_cobradas\` varchar(20) NOT NULL DEFAULT '', \`horas_bonificadas\` varchar(20) NOT NULL DEFAULT '', \`modulos\` text NOT NULL DEFAULT '', \`contato_nome\` varchar(160) NOT NULL DEFAULT '', \`contato_email\` varchar(160) NOT NULL DEFAULT '', \`contato_tel\` varchar(60) NOT NULL DEFAULT '', \`contatos\` text NOT NULL DEFAULT '', \`observacoes\` text NOT NULL DEFAULT '', \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`refresh_tokens\` (\`id\` int NOT NULL AUTO_INCREMENT, \`usuario_id\` int NOT NULL, \`token_hash\` varchar(128) NOT NULL, \`expira_em\` datetime NOT NULL, \`revogado\` tinyint NOT NULL DEFAULT 0, \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_c8349fdadc1bc791125bdd8c85\` (\`usuario_id\`), UNIQUE INDEX \`IDX_a7838d2ba25be1342091b6695f\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`checklist_modelo\` (\`id\` int NOT NULL AUTO_INCREMENT, \`ordem\` int NOT NULL DEFAULT '0', \`modulo\` varchar(40) NOT NULL DEFAULT '', \`adicional\` varchar(40) NOT NULL DEFAULT '', \`tipo\` varchar(60) NOT NULL DEFAULT '', \`integracoes\` text NOT NULL DEFAULT '', \`golive\` varchar(20) NOT NULL DEFAULT '', \`menu\` varchar(60) NOT NULL DEFAULT '', \`item\` text NOT NULL DEFAULT '', \`acao\` text NOT NULL DEFAULT '', \`seq\` varchar(20) NOT NULL DEFAULT '', INDEX \`IDX_173e94f74f3b206d2f027a3ee6\` (\`ordem\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`designacoes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`modulo\` varchar(80) NOT NULL DEFAULT '', \`consultor\` varchar(160) NOT NULL DEFAULT '', \`ordem\` int NOT NULL DEFAULT '0', \`nao_distribuir\` tinyint NOT NULL DEFAULT 0, \`analista\` varchar(160) NOT NULL DEFAULT '', INDEX \`IDX_ef1cc93589444ad91ec5cf3775\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`cronograma_atividades\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`modulo\` varchar(40) NOT NULL DEFAULT '', \`seq\` int NOT NULL DEFAULT '0', \`ordem\` int NOT NULL DEFAULT '0', \`descricao\` text NOT NULL DEFAULT '', \`tipo\` varchar(60) NOT NULL DEFAULT '', \`data\` varchar(10) NOT NULL DEFAULT '', \`turno\` varchar(10) NOT NULL DEFAULT '', \`tecnico\` varchar(120) NOT NULL DEFAULT '', \`status\` varchar(20) NOT NULL DEFAULT 'Solicitada', \`nova_data\` varchar(10) NOT NULL DEFAULT '', \`novo_turno\` varchar(10) NOT NULL DEFAULT '', \`origem_id\` int NOT NULL DEFAULT '0', \`is_copia\` tinyint NOT NULL DEFAULT 0, \`auto_agendado\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_d1bb34a5e33e7ec68476973a85\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`cronograma_slots\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`data\` varchar(10) NOT NULL DEFAULT '', \`turno\` varchar(10) NOT NULL DEFAULT '', \`hora_inicio\` varchar(5) NOT NULL DEFAULT '', \`hora_fim\` varchar(5) NOT NULL DEFAULT '', INDEX \`IDX_da0e42014bdada863c947a8911\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`cronograma_config\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`modo_disponibilidade\` varchar(20) NOT NULL DEFAULT 'conjunta', \`data_inicio\` varchar(10) NOT NULL DEFAULT '', \`dias_turnos_excluidos\` varchar(200) NOT NULL DEFAULT '', \`analista_padrao\` varchar(160) NOT NULL DEFAULT '', UNIQUE INDEX \`IDX_8636c58557fe5cdfff11616263\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`cronograma_periodos_bloqueados\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`data_ini\` varchar(10) NOT NULL DEFAULT '', \`data_fim\` varchar(10) NOT NULL DEFAULT '', \`motivo\` varchar(160) NOT NULL DEFAULT '', \`tecnicos\` varchar(400) NOT NULL DEFAULT '', INDEX \`IDX_28117443ffa91d14e89d0a0f5f\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`indice_topicos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`ordem\` int NOT NULL DEFAULT '0', \`modulo_num\` varchar(10) NOT NULL DEFAULT '', \`modulo_sigla\` varchar(10) NOT NULL DEFAULT '', \`modulo\` varchar(120) NOT NULL DEFAULT '', \`adicional_num\` varchar(10) NOT NULL DEFAULT '', \`adicional_sigla\` varchar(10) NOT NULL DEFAULT '', \`adicional\` varchar(120) NOT NULL DEFAULT '', \`topico\` text NOT NULL DEFAULT '', INDEX \`IDX_9c8c6ab90aa83e244c2dd23818\` (\`ordem\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`modelos_documento\` (\`id\` int NOT NULL AUTO_INCREMENT, \`slug\` varchar(40) NOT NULL DEFAULT '', \`nome\` varchar(160) NOT NULL DEFAULT '', \`fase\` varchar(40) NOT NULL DEFAULT '', \`tipo\` varchar(10) NOT NULL DEFAULT 'docx', \`arquivo\` varchar(200) NOT NULL DEFAULT '', \`descricao\` text NOT NULL DEFAULT '', \`ordem\` int NOT NULL DEFAULT '0', \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_89c62693d1591d390771c7e8f9\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`modelos_documento_versoes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`modelo_id\` int NOT NULL, \`versao\` int NOT NULL DEFAULT '1', \`arquivo\` varchar(200) NOT NULL DEFAULT '', \`autor\` varchar(120) NOT NULL DEFAULT '', \`motivo\` text NOT NULL DEFAULT '', \`vigente\` tinyint NOT NULL DEFAULT 0, \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_a218a12db56dc5c1507f9c4dce\` (\`modelo_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`modelos_documento_campos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`modelo_id\` int NOT NULL, \`ordem\` int NOT NULL DEFAULT '0', \`secao\` varchar(120) NOT NULL DEFAULT '', \`placeholder\` varchar(200) NOT NULL DEFAULT '', \`rotulo\` varchar(160) NOT NULL DEFAULT '', \`origem\` varchar(160) NOT NULL DEFAULT '', \`obrigatorio\` tinyint NOT NULL DEFAULT 0, \`observacao\` text NOT NULL DEFAULT '', INDEX \`IDX_5fe4158f27b1aa3b4ec7765799\` (\`modelo_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`levantamento_respostas\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`ordem\` int NOT NULL DEFAULT '0', \`modulo_sigla\` varchar(10) NOT NULL DEFAULT '', \`modulo\` varchar(120) NOT NULL DEFAULT '', \`adicional\` varchar(120) NOT NULL DEFAULT '', \`topico\` text NOT NULL DEFAULT '', \`resposta\` text NOT NULL DEFAULT '', INDEX \`IDX_3519e1156c4d43f4131f65872e\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`doc_conteudo\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`doc\` varchar(30) NOT NULL DEFAULT '', \`campo\` varchar(60) NOT NULL DEFAULT '', \`valor\` text NOT NULL DEFAULT '', INDEX \`IDX_98fc033504e2880b976913590c\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`documentos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`tipo\` varchar(40) NOT NULL DEFAULT '', \`arquivo\` varchar(255) NOT NULL DEFAULT '', \`caminho\` text NOT NULL DEFAULT '', \`origem\` varchar(20) NOT NULL DEFAULT 'gerado', \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_53c6b1747ce0065de5538d4756\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`eventos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`tipo\` varchar(30) NOT NULL DEFAULT 'nota', \`descricao\` text NOT NULL DEFAULT '', \`autor\` varchar(120) NOT NULL DEFAULT '', \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_30fe239aeefa3abc2080d242b6\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`protocolos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`titulo\` varchar(255) NOT NULL DEFAULT '', \`modulo\` varchar(60) NOT NULL DEFAULT 'Módulo a validar', \`menu\` varchar(120) NOT NULL DEFAULT 'Menu não identificado - revisar manualmente', \`assunto\` varchar(255) NOT NULL DEFAULT '', \`resumo\` text NOT NULL DEFAULT '', \`objetivo\` text NOT NULL DEFAULT '', \`quando_utilizar\` text NOT NULL DEFAULT '', \`pre_requisitos\` text NOT NULL DEFAULT '', \`passo_a_passo\` text NOT NULL DEFAULT '', \`configuracoes\` text NOT NULL DEFAULT '', \`dependencias\` text NOT NULL DEFAULT '', \`regras_negocio\` text NOT NULL DEFAULT '', \`pontos_atencao\` text NOT NULL DEFAULT '', \`exemplos\` text NOT NULL DEFAULT '', \`assuntos_removidos\` text NOT NULL DEFAULT '', \`pendencias\` text NOT NULL DEFAULT '', \`video_nome\` varchar(255) NOT NULL DEFAULT '', \`video_caminho\` text NOT NULL DEFAULT '', \`video_origem\` varchar(20) NOT NULL DEFAULT 'sharepoint', \`video_hash\` varchar(40) NOT NULL DEFAULT '', \`duracao_seg\` int NOT NULL DEFAULT '0', \`transcricao\` text NOT NULL DEFAULT '', \`texto_ia\` text NOT NULL DEFAULT '', \`status\` varchar(30) NOT NULL DEFAULT 'Pendente', \`log_erro\` text NOT NULL DEFAULT '', \`historico\` text NOT NULL DEFAULT '', \`responsavel\` varchar(120) NOT NULL DEFAULT '', \`aprovador\` varchar(120) NOT NULL DEFAULT '', \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`processado_em\` datetime NULL, \`aprovado_em\` datetime NULL, INDEX \`IDX_4e2bb4ce64617fca4f4e29a94d\` (\`video_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`modelos_email\` (\`id\` int NOT NULL AUTO_INCREMENT, \`slug\` varchar(80) NOT NULL DEFAULT '', \`nome\` varchar(200) NOT NULL DEFAULT '', \`assunto\` varchar(300) NOT NULL DEFAULT '', \`corpo\` text NOT NULL DEFAULT '', \`etapa\` varchar(80) NOT NULL DEFAULT '', \`ativo\` tinyint NOT NULL DEFAULT 1, \`padrao\` tinyint NOT NULL DEFAULT 0, \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`atualizado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_a35fcd1395fe8eaa7d88b5e12f\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`consultas_bd\` (\`id\` int NOT NULL AUTO_INCREMENT, \`slug\` varchar(60) NOT NULL DEFAULT '', \`nome\` varchar(160) NOT NULL DEFAULT '', \`sql\` text NOT NULL DEFAULT '', \`ordem\` int NOT NULL DEFAULT '0', \`coluna_data\` varchar(120) NOT NULL DEFAULT '', \`coluna_situacao\` varchar(120) NOT NULL DEFAULT '', \`mostrar_grafico\` tinyint NOT NULL DEFAULT 0, UNIQUE INDEX \`IDX_5d12f72f6cbc4a0d40c30c7e94\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`matriz_competencias\` (\`id\` int NOT NULL AUTO_INCREMENT, \`sigla\` varchar(80) NOT NULL DEFAULT '', \`area\` varchar(80) NOT NULL DEFAULT '', \`ordem\` int NOT NULL DEFAULT '0', INDEX \`IDX_1846c16d08a5a4956b4370f72c\` (\`sigla\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`matriz_tecnicos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`nome\` varchar(120) NOT NULL DEFAULT '', \`setor\` varchar(80) NOT NULL DEFAULT '', \`dias\` varchar(20) NOT NULL DEFAULT '', \`notas\` text NOT NULL DEFAULT '{}', \`atualizado_em\` datetime NULL, \`atualizado_por\` varchar(120) NOT NULL DEFAULT '', INDEX \`IDX_3601aa6a434e0f5ae52e61701b\` (\`nome\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`cadastros_pendentes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`nome\` varchar(120) NOT NULL DEFAULT '', \`login\` varchar(120) NOT NULL DEFAULT '', \`email\` varchar(160) NOT NULL DEFAULT '', \`senha_hash\` text NOT NULL DEFAULT '', \`codigo_sicla\` varchar(40) NOT NULL DEFAULT '', \`codigo\` varchar(6) NOT NULL DEFAULT '', \`tentativas\` int NOT NULL DEFAULT '0', \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_3b84eafa42aea78324ed3980fd\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`cronograma_itens\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`ordem\` int NOT NULL DEFAULT '0', \`etapa\` text NOT NULL DEFAULT '', \`topicos\` text NOT NULL DEFAULT '', \`horas\` varchar(20) NOT NULL DEFAULT '', \`data\` varchar(20) NOT NULL DEFAULT '', \`modalidade\` varchar(40) NOT NULL DEFAULT '', \`status\` varchar(30) NOT NULL DEFAULT 'Previsto', INDEX \`IDX_7694c998b0a52cfa0143f78b5e\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`checklist_itens\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`ordem\` int NOT NULL DEFAULT '0', \`modulo\` varchar(80) NOT NULL DEFAULT '', \`item\` text NOT NULL DEFAULT '', \`responsavel\` varchar(160) NOT NULL DEFAULT '', \`status\` varchar(30) NOT NULL DEFAULT 'Pendente', \`obs\` text NOT NULL DEFAULT '', INDEX \`IDX_6b444b5d0c13d45c06e8f2c22f\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`modificacoes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`projeto_id\` int NOT NULL, \`entidade\` varchar(30) NOT NULL DEFAULT '', \`ref\` varchar(60) NOT NULL DEFAULT '', \`campo\` varchar(40) NOT NULL DEFAULT '', \`de\` text NOT NULL DEFAULT '', \`para\` text NOT NULL DEFAULT '', \`autor\` varchar(120) NOT NULL DEFAULT '', \`criado_em\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_90679b54d8be688c2535759c82\` (\`projeto_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_90679b54d8be688c2535759c82\` ON \`modificacoes\``,
    );
    await queryRunner.query(`DROP TABLE \`modificacoes\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_6b444b5d0c13d45c06e8f2c22f\` ON \`checklist_itens\``,
    );
    await queryRunner.query(`DROP TABLE \`checklist_itens\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_7694c998b0a52cfa0143f78b5e\` ON \`cronograma_itens\``,
    );
    await queryRunner.query(`DROP TABLE \`cronograma_itens\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_3b84eafa42aea78324ed3980fd\` ON \`cadastros_pendentes\``,
    );
    await queryRunner.query(`DROP TABLE \`cadastros_pendentes\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_3601aa6a434e0f5ae52e61701b\` ON \`matriz_tecnicos\``,
    );
    await queryRunner.query(`DROP TABLE \`matriz_tecnicos\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_1846c16d08a5a4956b4370f72c\` ON \`matriz_competencias\``,
    );
    await queryRunner.query(`DROP TABLE \`matriz_competencias\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_5d12f72f6cbc4a0d40c30c7e94\` ON \`consultas_bd\``,
    );
    await queryRunner.query(`DROP TABLE \`consultas_bd\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_a35fcd1395fe8eaa7d88b5e12f\` ON \`modelos_email\``,
    );
    await queryRunner.query(`DROP TABLE \`modelos_email\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_4e2bb4ce64617fca4f4e29a94d\` ON \`protocolos\``,
    );
    await queryRunner.query(`DROP TABLE \`protocolos\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_30fe239aeefa3abc2080d242b6\` ON \`eventos\``,
    );
    await queryRunner.query(`DROP TABLE \`eventos\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_53c6b1747ce0065de5538d4756\` ON \`documentos\``,
    );
    await queryRunner.query(`DROP TABLE \`documentos\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_98fc033504e2880b976913590c\` ON \`doc_conteudo\``,
    );
    await queryRunner.query(`DROP TABLE \`doc_conteudo\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_3519e1156c4d43f4131f65872e\` ON \`levantamento_respostas\``,
    );
    await queryRunner.query(`DROP TABLE \`levantamento_respostas\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_5fe4158f27b1aa3b4ec7765799\` ON \`modelos_documento_campos\``,
    );
    await queryRunner.query(`DROP TABLE \`modelos_documento_campos\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_a218a12db56dc5c1507f9c4dce\` ON \`modelos_documento_versoes\``,
    );
    await queryRunner.query(`DROP TABLE \`modelos_documento_versoes\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_89c62693d1591d390771c7e8f9\` ON \`modelos_documento\``,
    );
    await queryRunner.query(`DROP TABLE \`modelos_documento\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_9c8c6ab90aa83e244c2dd23818\` ON \`indice_topicos\``,
    );
    await queryRunner.query(`DROP TABLE \`indice_topicos\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_28117443ffa91d14e89d0a0f5f\` ON \`cronograma_periodos_bloqueados\``,
    );
    await queryRunner.query(`DROP TABLE \`cronograma_periodos_bloqueados\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_8636c58557fe5cdfff11616263\` ON \`cronograma_config\``,
    );
    await queryRunner.query(`DROP TABLE \`cronograma_config\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_da0e42014bdada863c947a8911\` ON \`cronograma_slots\``,
    );
    await queryRunner.query(`DROP TABLE \`cronograma_slots\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_d1bb34a5e33e7ec68476973a85\` ON \`cronograma_atividades\``,
    );
    await queryRunner.query(`DROP TABLE \`cronograma_atividades\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_ef1cc93589444ad91ec5cf3775\` ON \`designacoes\``,
    );
    await queryRunner.query(`DROP TABLE \`designacoes\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_173e94f74f3b206d2f027a3ee6\` ON \`checklist_modelo\``,
    );
    await queryRunner.query(`DROP TABLE \`checklist_modelo\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_a7838d2ba25be1342091b6695f\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_c8349fdadc1bc791125bdd8c85\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
    await queryRunner.query(`DROP TABLE \`projetos\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_0c0fcf4a8c228628476a29ea30\` ON \`usuarios\``,
    );
    await queryRunner.query(`DROP TABLE \`usuarios\``);
  }
}
