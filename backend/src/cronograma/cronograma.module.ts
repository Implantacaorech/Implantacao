import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';
import { SlotCronograma } from '../database/entities/slot-cronograma.entity';
import { CronogramaConfig } from '../database/entities/cronograma-config.entity';
import { CronogramaPeriodoBloqueado } from '../database/entities/cronograma-periodo-bloqueado.entity';
import { Designacao } from '../database/entities/designacao.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { GeracaoModule } from '../geracao/geracao.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { EmailModule } from '../email/email.module';
import { CronogramaService } from './cronograma.service';
import { DesignacoesService } from './designacoes.service';
import { DistribuicaoService } from './distribuicao.service';
import { CronogramaController } from './cronograma.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AtividadeCronograma,
      SlotCronograma,
      CronogramaConfig,
      CronogramaPeriodoBloqueado,
      Designacao,
      Projeto,
    ]),
    CatalogosModule,
    GeracaoModule,
    DocumentosModule,
    EmailModule,
  ],
  controllers: [CronogramaController],
  providers: [CronogramaService, DesignacoesService, DistribuicaoService],
  exports: [CronogramaService, DesignacoesService, DistribuicaoService],
})
export class CronogramaModule {}
