import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `api_clientes.escopos` → `api_clientes.consultas`.
 *
 * A autorização de um token de máquina passou de POR CONEXÃO (`sicla:leitura`, que abria as
 * 18 consultas do SICLA de uma vez) para POR CONSULTA (a lista de nomes que aquele token
 * pode chamar). Decisão do usuário em 2026-08-25, no desenho das duas instâncias: um token
 * emitido para o painel de RNS não deve alcançar o extrato de horas.
 *
 * Renomear é seguro aqui: a tabela nasceu na migration anterior e está VAZIA em produção
 * (conferido antes de escrever esta). Se algum ambiente já tiver linhas, os valores antigos
 * (`sicla:leitura`) deixam de casar com nome de consulta e o token para de autorizar — o
 * cadastro precisa ser refeito na tela, de propósito: converter "toda a conexão" em "todas
 * as consultas dela" reintroduziria justamente o acesso amplo que esta mudança remove.
 */
export class TokenPorConsulta1788000000000 implements MigrationInterface {
  name = 'TokenPorConsulta1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `api_clientes` CHANGE `escopos` `consultas` text NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `api_clientes` CHANGE `consultas` `escopos` text NOT NULL',
    );
  }
}
