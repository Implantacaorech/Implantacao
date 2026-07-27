import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import configuration, { AppConfig } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjetosModule } from './projetos/projetos.module';
import { HealthModule } from './health/health.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { CronogramaModule } from './cronograma/cronograma.module';
import { LevantamentoModule } from './levantamento/levantamento.module';
import { IaModule } from './ia/ia.module';
import { ProtocolosModule } from './protocolos/protocolos.module';
import { EmailModule } from './email/email.module';
import { FluxoModule } from './fluxo/fluxo.module';
import { DisponibilidadeModule } from './disponibilidade/disponibilidade.module';
import { MatrizModule } from './matriz/matriz.module';
import { PainelModule } from './painel/painel.module';
import { CadastroModule } from './cadastro/cadastro.module';
import { DesignacaoModule } from './designacao/designacao.module';
import { DigestModule } from './digest/digest.module';
import { PlanoCronogramaModule } from './plano-cronograma/plano-cronograma.module';
import { LegadoModule } from './legado/legado.module';
import { AgentesModule } from './agentes/agentes.module';
import { DicionarioModule } from './dicionario/dicionario.module';
import { PassosModule } from './passos/passos.module';
import { ClientesSiclaModule } from './clientes-sicla/clientes-sicla.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    // Serve o build de produção do Angular (`ng build`) direto pelo NestJS — um único
    // processo/porta em produção (ver configuration.ts:frontendDistPath), evitando CORS/
    // reverse proxy para uma ferramenta interna. `/api/*` fica de fora (API real); tudo
    // que não bater em nenhuma rota do Nest cai no fallback de SPA (serve index.html),
    // para o roteador do Angular funcionar em deep link (ex.: recarregar em /projetos/5).
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
    AuthModule,
    UsersModule,
    ProjetosModule,
    HealthModule,
    CatalogosModule,
    CronogramaModule,
    LevantamentoModule,
    IaModule,
    ProtocolosModule,
    EmailModule,
    FluxoModule,
    DisponibilidadeModule,
    MatrizModule,
    PainelModule,
    CadastroModule,
    DesignacaoModule,
    DigestModule,
    PlanoCronogramaModule,
    LegadoModule,
    AgentesModule,
    DicionarioModule,
    PassosModule,
    ClientesSiclaModule,
  ],
})
export class AppModule {}
