import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/configuration';
import { ENTITIES } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const db = config.get('db', { infer: true });
        const common = {
          entities: ENTITIES,
          // Nunca sincronizar automaticamente o schema em cima de um banco de produção —
          // toda mudança de estrutura passa por migration versionada (ver
          // docs/migracao/02-decisao-arquitetura.md). Em SQLite (dev/testes, mesmo padrão
          // que o Flask já usa hoje) sincronizar é seguro: banco descartável, sem dado real.
          synchronize: db.type === 'better-sqlite3',
          migrationsRun: false,
        };
        if (db.type === 'mariadb') {
          // Sem `charset: 'utf8mb4'`, o driver mysql2 negocia utf8mb3 (utf8 legado, 3
          // bytes) na CONEXÃO mesmo com o servidor/tabelas em utf8mb4 — corrompe
          // silenciosamente qualquer acento (ex.: "ção" virava "��o"). Achado real ao
          // validar a migração para MariaDB (2026-07-17).
          return {
            type: 'mariadb' as const,
            url: db.url,
            charset: 'utf8mb4',
            ...common,
          };
        }
        return {
          type: 'better-sqlite3' as const,
          database: db.sqlitePath,
          ...common,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
