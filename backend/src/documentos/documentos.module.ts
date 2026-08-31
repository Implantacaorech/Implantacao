import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Documento } from '../database/entities/documento.entity';
import { Evento } from '../database/entities/evento.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { LevantamentoModule } from '../levantamento/levantamento.module';
import { GeracaoModule } from '../geracao/geracao.module';
import { EmailModule } from '../email/email.module';
import { PlanoCronogramaModule } from '../plano-cronograma/plano-cronograma.module';
import { MetricasModule } from '../metricas/metricas.module';
import { DocumentosService } from './documentos.service';
import { GeracaoLayoutService } from './geracao-layout.service';
import { DocumentosController } from './documentos.controller';
import { PassosModule } from '../passos/passos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Documento, Evento, Projeto]),
    CatalogosModule,
    LevantamentoModule,
    GeracaoModule,
    EmailModule,
    PlanoCronogramaModule,
    MetricasModule,
    forwardRef(() => PassosModule),
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService, GeracaoLayoutService],
  exports: [DocumentosService, GeracaoLayoutService],
})
export class DocumentosModule {}
