import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from '../config/configuration';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PermissoesModule } from '../permissoes/permissoes.module';
import { HealthModule } from '../health/health.module';
import { DadosModule } from './dados.module';

/** **PORTAL DE CONEXÕES** — a raiz da *instância 1* do desenho de duas instâncias
 * (decidido com o usuário em 2026-08-25, ver `docs/portal-conexoes.md`).
 *
 * A instância 1 roda na REDE INTERNA e é a única que tem credencial de banco externo. A
 * instância 2 é o Painel publicado (nuvem), que consome esta por token e **não guarda
 * nenhum dado de conexão** — a exigência que originou o desenho:
 *
 * > "Não poderei deixar no portal e em lugar nenhum os dados de conexão com o banco."
 *
 * O ganho não é de código, é de SUPERFÍCIE: o processo que segura a credencial do Oracle
 * expõe só a API de Dados, autenticação e permissões. Se a instância da nuvem cair nas
 * mãos de alguém, o que ele alcança é uma lista de consultas nomeadas com teto de linhas —
 * não um banco.
 *
 * Por isso a lista de `imports` abaixo é curta **de propósito**, e o teste
 * `dados-app.module.spec.ts` recusa qualquer módulo de negócio novo aqui: cada módulo
 * acrescentado é rota exposta na máquina que tem a senha do banco. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRootAsync({
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { ttlSegundos, limite } = config.get('rateLimit', {
          infer: true,
        });
        return { throttlers: [{ ttl: ttlSegundos * 1000, limit: limite }] };
      },
      inject: [ConfigService],
    }),
    // Serve o MESMO build do Angular do Painel. Só as telas da área Sistema → API de Dados
    // (catálogo, consultas, clientes de máquina) funcionam aqui — o resto do menu chama
    // endpoints que este processo não expõe, e é exatamente essa a intenção. O endereço de
    // trabalho é `/config/api-dados`.
    ServeStaticModule.forRootAsync({
      useFactory: (config: ConfigService<AppConfig, true>) => [
        {
          rootPath: config.get('frontendDistPath', { infer: true }),
          exclude: ['/api/{*splat}'],
        },
      ],
      inject: [ConfigService],
    }),
    DatabaseModule,
    // Autenticação e permissões: quem administra o Portal de Conexões é PESSOA, com o mesmo
    // login do Painel e o mesmo perfil ADM. Sem estes dois, `/api/dados/v1/admin` não teria
    // como distinguir o Administrador de qualquer um que alcance a porta.
    AuthModule,
    UsersModule,
    PermissoesModule,
    // `/api/health` — é o que o túnel e o guardião consultam.
    HealthModule,
    DadosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class DadosAppModule {}
