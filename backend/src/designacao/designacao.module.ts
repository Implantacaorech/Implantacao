import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { Evento } from '../database/entities/evento.entity';
import { Designacao } from '../database/entities/designacao.entity';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { MetricasModule } from '../metricas/metricas.module';
import { DesignacaoService } from './designacao.service';
import { DesignacaoController } from './designacao.controller';
import { PassosModule } from '../passos/passos.module';

@Module({
  imports: [
    PassosModule,
    TypeOrmModule.forFeature([Projeto, Documento, Evento, Designacao]),
    UsersModule,
    EmailModule,
    MetricasModule,
  ],
  controllers: [DesignacaoController],
  providers: [DesignacaoService],
})
export class DesignacaoModule {}
