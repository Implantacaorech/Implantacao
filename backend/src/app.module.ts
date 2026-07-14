import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
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
  ],
})
export class AppModule {}
