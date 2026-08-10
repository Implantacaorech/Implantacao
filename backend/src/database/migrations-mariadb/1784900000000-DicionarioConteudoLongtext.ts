import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `dicionario_documentos.conteudo` guarda o markdown INTEIRO de um módulo do SIGER, e estava
 * em `TEXT` — 65.535 bytes.
 *
 * Não é risco teórico: em 2026-08-10 o maior documento do acervo (`19-ftr-faturas-programas-
 * especificos`) já ocupava **57.999 bytes, 88% do teto**. O próximo módulo que crescer um
 * pouco derruba a ingestão com o mesmo `Data too long` que derrubou a transcrição no mesmo
 * dia — e ali o prejuízo foi perder horas de processamento.
 *
 * Alargar antes de estourar é a diferença entre uma migration tranquila e um incidente. Como
 * na transcrição, o motivo de ninguém ter percebido é que dev/teste rodam em SQLite, onde
 * `TEXT` não tem limite.
 *
 * ⚠️ A ENTIDADE continua declarando `type: 'text'`, de propósito — o driver SQLite do TypeORM
 * não conhece `longtext` e falharia no boot dos testes; `synchronize` é FALSE no MariaDB,
 * então o tipo alargado aqui não é revertido. Mesmo padrão de
 * `TranscricaoLongtext1784890000000`.
 */
export class DicionarioConteudoLongtext1784900000000 implements MigrationInterface {
  name = 'DicionarioConteudoLongtext1784900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `dicionario_documentos` MODIFY `conteudo` LONGTEXT NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Voltar para TEXT TRUNCA em silêncio o que não couber, em vez de recusar — por isso o
    // down aborta se existir documento acima do limite antigo.
    const [{ grandes }] = (await queryRunner.query(
      'SELECT COUNT(*) AS grandes FROM `dicionario_documentos` WHERE LENGTH(`conteudo`) > 65535',
    )) as { grandes: number }[];
    if (Number(grandes) > 0) {
      throw new Error(
        `Não dá para reverter: ${grandes} documento(s) do dicionário passam de 64 KB e ` +
          'voltar para TEXT truncaria o conteúdo. Reduza ou remova esses documentos antes.',
      );
    }
    await queryRunner.query(
      'ALTER TABLE `dicionario_documentos` MODIFY `conteudo` TEXT NOT NULL',
    );
  }
}
