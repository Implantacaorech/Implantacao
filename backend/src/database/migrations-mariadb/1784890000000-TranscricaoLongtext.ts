import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `TEXT` do MariaDB são 64 KB — pouco para uma transcrição de reunião.
 *
 * Erro real em produção (2026-08-10), ao processar um treinamento de ~3 horas:
 *
 *     QueryFailedError: Data too long for column 'transcricao' at row 1
 *
 * A conta fecha: o texto sai com um bloco por fala (`[MM:SS] ...`), algo como 2.000+ linhas
 * numa gravação longa, e cada acento custa 2 bytes em utf8mb4. Passar de 64 KB é o normal,
 * não a exceção — e o resultado era perder a transcrição INTEIRA depois de mais de uma hora
 * de processamento, porque o INSERT falhava no fim.
 *
 * Por que só aparece em produção: o banco de desenvolvimento/teste é SQLite, onde `TEXT` não
 * tem limite nenhum. Nenhuma suíte pegaria isso.
 *
 * Alarga as QUATRO colunas que carregam conteúdo derivado da transcrição, não só a que
 * estourou — as outras três recebem material do mesmo tamanho e cairiam no mesmo erro logo
 * em seguida:
 *   `transcricao`     — o texto completo da gravação;
 *   `resumo_completo` — o registro que cobre a transcrição do começo ao fim (2ª chamada de IA);
 *   `texto_ia`        — a resposta crua da IA (JSON com as ~24 seções do protocolo);
 *   `historico`       — acumula ao longo da vida do protocolo.
 *
 * LONGTEXT (4 GB) em vez de MEDIUMTEXT (16 MB) porque a diferença de custo é nula aqui e não
 * se volta a esta migration por causa de uma reunião mais longa.
 *
 * ⚠️ A ENTIDADE continua declarando `type: 'text'`, de propósito — ver
 * `protocolo.entity.ts`. O driver SQLite do TypeORM não conhece `longtext` e falharia no
 * boot do ambiente de teste; como `synchronize` é FALSE no MariaDB, o tipo alargado aqui não
 * é revertido.
 */
export class TranscricaoLongtext1784890000000 implements MigrationInterface {
  name = 'TranscricaoLongtext1784890000000';

  private static readonly COLUNAS = [
    'transcricao',
    'resumo_completo',
    'texto_ia',
    'historico',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const coluna of TranscricaoLongtext1784890000000.COLUNAS) {
      await queryRunner.query(
        `ALTER TABLE \`protocolos\` MODIFY \`${coluna}\` LONGTEXT NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volta a TEXT. Atenção: se alguma linha já passar de 64 KB, o MariaDB TRUNCA em vez de
    // recusar — por isso o down aborta quando encontra conteúdo que não caberia.
    for (const coluna of TranscricaoLongtext1784890000000.COLUNAS) {
      const [{ grandes }] = (await queryRunner.query(
        `SELECT COUNT(*) AS grandes FROM \`protocolos\` WHERE LENGTH(\`${coluna}\`) > 65535`,
      )) as { grandes: number }[];
      if (Number(grandes) > 0) {
        throw new Error(
          `Não dá para reverter: ${grandes} protocolo(s) têm '${coluna}' acima de 64 KB e ` +
            'voltar para TEXT truncaria o conteúdo. Exporte ou limpe esses registros antes.',
        );
      }
    }
    for (const coluna of TranscricaoLongtext1784890000000.COLUNAS) {
      await queryRunner.query(
        `ALTER TABLE \`protocolos\` MODIFY \`${coluna}\` TEXT NOT NULL`,
      );
    }
  }
}
