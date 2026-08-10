import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';

// DataSource dedicado ao TypeORM CLI (migration:generate/run/revert) — não é usado em
// runtime pelo Nest (que usa DatabaseModule/TypeOrmModule.forRootAsync).
// Usa MIGRACAO_DB_URL — nunca PAINEL_DB_URL (variável do Painel Flask desligado em
// 2026-07-19, schema incompatível; ver configuration.ts).
const dbUrl = process.env.MIGRACAO_DB_URL;

// Banco obrigatório pela §4.8 do Padrão Rech: MariaDB — único dialeto de produção aceito
// (mesma exigência de configuration.ts:exigirMariaDb). Sem MIGRACAO_DB_URL, cai no SQLite
// descartável de desenvolvimento/teste, que sincroniza o schema direto e por isso não
// precisa de migration. As migrations versionadas vivem só em migrations-mariadb/.
if (dbUrl && !/^(mysql|mariadb):\/\//i.test(dbUrl)) {
  throw new Error(
    'MIGRACAO_DB_URL precisa ser uma URL mysql:// ou mariadb:// — o banco obrigatório do ' +
      'Padrão Rech (§4.8) é o MariaDB.',
  );
}

export const AppDataSource = new DataSource(
  dbUrl
    ? {
        type: 'mariadb',
        url: dbUrl,
        entities: ENTITIES,
        // `!(...).spec.ts` exclui os testes que vivem junto das migrations. Sem isso o
        // runner tentava carregar o .spec como se fosse uma migration e morria com
        // "ReferenceError: describe is not defined" — erro que não diz nada sobre a causa e
        // que só aparece na hora de migrar a PRODUÇÃO, porque em SQLite não se roda migration.
        // Só `src/**.ts`: este DataSource é usado pelo CLI do TypeORM, que roda por ts-node.
        // Incluir também o `dist/**.js` faz cada migration ser carregada DUAS vezes e o
        // runner aborta com "Duplicate migrations".
        migrations: ['src/database/migrations-mariadb/!(*.spec).ts'],
        synchronize: false,
        // Mesmo motivo de database.module.ts: sem isto, o driver mysql2 negocia utf8mb3
        // (legado) na conexão mesmo com o servidor em utf8mb4, corrompendo acento.
        charset: 'utf8mb4',
      }
    : {
        type: 'better-sqlite3',
        database: process.env.MIGRACAO_DB_SQLITE ?? 'dados/painel.sqlite',
        entities: ENTITIES,
        // Banco de teste/dev é descartável: sincroniza o schema a partir das entities.
        synchronize: true,
      },
);
