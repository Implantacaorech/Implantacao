import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';

// DataSource dedicado ao TypeORM CLI (migration:generate/run/revert) — não é usado em
// runtime pelo Nest (que usa DatabaseModule/TypeOrmModule.forRootAsync).
// Usa MIGRACAO_DB_URL — nunca PAINEL_DB_URL (variável do Painel Flask em produção, schema
// incompatível; ver configuration.ts e docs/migracao/03-documento-conversao.md).
const dbUrl = process.env.MIGRACAO_DB_URL;

export const AppDataSource = new DataSource(
  dbUrl
    ? {
        type: 'postgres',
        url: dbUrl,
        entities: ENTITIES,
        migrations: ['src/database/migrations/*.ts'],
        synchronize: false,
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
