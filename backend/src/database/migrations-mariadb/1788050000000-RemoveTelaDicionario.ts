import { MigrationInterface, QueryRunner } from 'typeorm';

/** Remove a TELA "Dicionário Inteligente" (decisão do usuário em 2026-09-01).
 *
 * ⚠️ **A tabela `dicionario_documentos` FICA, e isso é deliberado.** Ela deixou de ser tela e
 * passou a ser apenas INSUMO: os 87 documentos (21 módulos + 66 adicionais) são a fonte única
 * da taxonomia de menus do SIGER, lida por `MenusSigerService` e usada por
 *
 *   - **Matriz por Menu (SIGER)** — monta as notas por menu a partir dessa taxonomia;
 *   - **Processamento de protocolos** — reconhece os menus citados na transcrição.
 *
 * Derrubar a tabela quebraria as duas em silêncio (a Matriz ficaria vazia e o resumo voltaria
 * a não citar menu nenhum, desfazendo o que o PR #31 corrigiu). O escopo da remoção foi
 * confirmado com o usuário: sai a tela e a API, fica o insumo — junto com o script de
 * ingestão `backend/scripts/ingerir-dicionario-siger.ts`, que é como a tabela se atualiza.
 *
 * Aqui só saem as permissões da chave de menu `dicionario`, que ficariam órfãs apontando para
 * um menu inexistente. Mesmo tratamento do Wall-e (1787270400000) e do Consultor SIGER
 * (1788040000000). */
export class RemoveTelaDicionario1788050000000 implements MigrationInterface {
  name = 'RemoveTelaDicionario1788050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`permissoes_papel\` WHERE \`menu\` = 'dicionario'`,
    );
    await queryRunner.query(
      `DELETE FROM \`permissoes_usuario\` WHERE \`menu\` = 'dicionario'`,
    );
  }

  /** Sem volta: as liberações eram configuração, não dado de negócio. */
  public async down(): Promise<void> {
    // intencionalmente vazio
  }
}
