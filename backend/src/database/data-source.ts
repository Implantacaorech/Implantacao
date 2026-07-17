import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';

// DataSource dedicado ao TypeORM CLI (migration:generate/run/revert) — não é usado em
// runtime pelo Nest (que usa DatabaseModule/TypeOrmModule.forRootAsync).
// Usa MIGRACAO_DB_URL — nunca PAINEL_DB_URL (variável do Painel Flask em produção, schema
// incompatível; ver configuration.ts e docs/migracao/03-documento-conversao.md).
const dbUrl = process.env.MIGRACAO_DB_URL;
// Mesma detecção de dialeto de configuration.ts — migração postgres->mariadb (2026-07).
// Migrations separadas por dialeto: as 10 existentes em migrations/ foram geradas contra
// Postgres (sintaxe DDL não é portável 1:1 entre dialetos); migrations-mariadb/ é o
// schema inicial consolidado gerado do zero contra o MariaDB (banco novo, sem histórico
// a preservar — não faz sentido "traduzir" as 10 incrementais uma a uma).
const ehMariaDb = !!dbUrl && /^(mysql|mariadb):\/\//i.test(dbUrl);

export const AppDataSource = new DataSource(
  dbUrl
    ? {
        type: ehMariaDb ? 'mariadb' : 'postgres',
        url: dbUrl,
        entities: ENTITIES,
        migrations: [
          ehMariaDb
            ? 'src/database/migrations-mariadb/*.ts'
            : 'src/database/migrations/*.ts',
        ],
        synchronize: false,
        // Mesmo motivo de database.module.ts: sem isto, o driver mysql2 negocia utf8mb3
        // (legado) na conexão mesmo com o servidor em utf8mb4, corrompendo acento.
        ...(ehMariaDb ? { charset: 'utf8mb4' } : {}),
      }
    : {
        type: 'better-sqlite3',
        database: process.env.MIGRACAO_DB_SQLITE ?? 'dados/painel.sqlite',
        entities: ENTITIES,
        migrations: ['src/database/migrations/*.ts'],
        // SQLite local (dev/seed) pode sincronizar direto — só o Postgres (produção) exige
        // migration versionada.
        synchronize: true,
      },
);
