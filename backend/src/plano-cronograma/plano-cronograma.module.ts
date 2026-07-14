import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import { CronogramaItem } from '../database/entities/cronograma-item.entity';
import { ChecklistItem } from '../database/entities/checklist-item.entity';
import { Modificacao } from '../database/entities/modificacao.entity';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { CronogramaItensService } from './cronograma-itens.service';
import { ChecklistItensService } from './checklist-itens.service';
import { ModificacoesService } from './modificacoes.service';
import { PlanoCronogramaController } from './plano-cronograma.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Projeto, Evento, CronogramaItem, ChecklistItem, Modificacao]),
    CatalogosModule,
  ],
  controllers: [PlanoCronogramaController],
  providers: [CronogramaItensService, ChecklistItensService, ModificacoesService],
  exports: [CronogramaItensService, ChecklistItensService, ModificacoesService],
})
export class PlanoCronogramaModule {}
