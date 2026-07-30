import { MigrationInterface, QueryRunner } from 'typeorm';

const COLUNAS = [
  'menus_abordados',
  'funcionalidades',
  'processos',
  'definicoes',
  'duvidas',
  'pendencias_treinamento',
  'proximos_passos',
  'resumo_tecnico',
];

/** Novas seções do protocolo de treinamento (prompt reescrito em 2026-07-29 — ver
 * protocolo-ia.service.ts). Os registros antigos ficam com as colunas vazias; basta
 * reprocessar o protocolo (a transcrição já feita é aproveitada) para preenchê-las. */
export class ProtocoloSecoesTreinamento1784780000000 implements MigrationInterface {
  name = 'ProtocoloSecoesTreinamento1784780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const coluna of COLUNAS) {
      await queryRunner.query(
        `ALTER TABLE \`protocolos\` ADD \`${coluna}\` text NOT NULL DEFAULT ''`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const coluna of [...COLUNAS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE \`protocolos\` DROP COLUMN \`${coluna}\``,
      );
    }
  }
}
