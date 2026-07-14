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
          // Nunca sincronizar automaticamente o schema em cima do Postgres de produção —
          // toda mudança de estrutura passa por migration versionada (ver
          // docs/migracao/02-decisao-arquitetura.md). Em SQLite (dev/testes, mesmo padrão
          // que o Flask já usa hoje) sincronizar é seguro: banco descartável, sem dado real.
          synchronize: db.type !== 'postgres',
          migrationsRun: false,
        };
        if (db.type === 'postgres') {
          return { type: 'postgres' as const, url: db.url, ...common };
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
