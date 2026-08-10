import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Conserta um estrago da `TranscricaoLongtext1784890000000`, no mesmo dia (2026-08-10).
 *
 * Aquela migration alargou quatro colunas com:
 *
 *     ALTER TABLE `protocolos` MODIFY `resumo_completo` LONGTEXT NOT NULL
 *
 * `MODIFY` **substitui a definição inteira da coluna** — não altera só o tipo. Como o
 * `DEFAULT ''` não foi repetido no comando, ele foi silenciosamente descartado. As colunas
 * originais eram `text NOT NULL DEFAULT ''` (conferido no dump tirado antes da migration).
 *
 * O efeito apareceu no primeiro INSERT: as entidades não enviam esses campos ao criar um
 * protocolo (contam com o default), e o MariaDB em modo estrito recusa com
 *
 *     QueryFailedError: Field 'resumo_completo' doesn't have a default value
 *
 * Na prática, **parou de ser possível registrar protocolo**: o upload manual devolvia "Não
 * foi possível enviar o arquivo" e o robô do SharePoint falhava em todo vídeo da pasta.
 *
 * Nenhuma suíte pegaria: em SQLite `synchronize` recria o schema a partir da entidade, que
 * declara `default: ''` — o desvio só existe no MariaDB, onde o schema vem das migrations.
 *
 * A `DicionarioConteudoLongtext1784900000000` NÃO tem o mesmo problema: `conteudo` já era
 * `text NOT NULL` sem default, então repetir `NOT NULL` preservou a definição.
 */
export class RestauraDefaultTranscricao1784910000000 implements MigrationInterface {
  name = 'RestauraDefaultTranscricao1784910000000';

  private static readonly COLUNAS = [
    'transcricao',
    'resumo_completo',
    'texto_ia',
    'historico',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const coluna of RestauraDefaultTranscricao1784910000000.COLUNAS) {
      await queryRunner.query(
        `ALTER TABLE \`protocolos\` MODIFY \`${coluna}\` LONGTEXT NOT NULL DEFAULT ''`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volta ao estado (defeituoso) deixado pela 1784890000000, para que o par up/down seja
    // reversível de verdade. Ninguém deveria querer isto fora de um teste de migração.
    for (const coluna of RestauraDefaultTranscricao1784910000000.COLUNAS) {
      await queryRunner.query(
        `ALTER TABLE \`protocolos\` MODIFY \`${coluna}\` LONGTEXT NOT NULL`,
      );
    }
  }
}
