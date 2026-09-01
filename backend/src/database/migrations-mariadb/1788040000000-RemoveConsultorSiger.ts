import { MigrationInterface, QueryRunner } from 'typeorm';

/** Remove o módulo **Consultor SIGER** (decisão do usuário em 2026-09-01: "não faremos uso").
 *
 * O módulo não tinha tabela própria no `painel_novo` — a base que ele consultava é um
 * artefato DERIVADO, um SQLite gerado fora deste repositório (`F:\CONSULTOR-SIGER\data\
 * consultor.db`) e aberto em somente-leitura. Não há dado do Painel a derrubar: sobra
 * limpar as permissões da chave de menu `consultor_siger`, que o painel de Permissões
 * gravou por papel e por usuário.
 *
 * Sem isto, as linhas ficariam órfãs apontando para um menu que não existe mais — inofensivas
 * para o acesso (o guard só conhece as chaves do código), mas ruído permanente na tela de
 * Permissões e na auditoria. Mesmo tratamento dado ao Wall-e em 1787270400000.
 *
 * Nem a base derivada nem a fonte `F:\SIGER` são tocadas: o Painel nunca escreveu em
 * nenhuma das duas. O código do módulo fica no histórico do git. */
export class RemoveConsultorSiger1788040000000 implements MigrationInterface {
  name = 'RemoveConsultorSiger1788040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`permissoes_papel\` WHERE \`menu\` = 'consultor_siger'`,
    );
    await queryRunner.query(
      `DELETE FROM \`permissoes_usuario\` WHERE \`menu\` = 'consultor_siger'`,
    );
  }

  /** Sem volta: as liberações eram configuração, não dado de negócio. Repor o módulo é
   * reverter o código; as permissões o Administrador redefine na tela, como fez da 1ª vez. */
  public async down(): Promise<void> {
    // intencionalmente vazio
  }
}
