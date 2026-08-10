import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronogramaItem } from '../database/entities/cronograma-item.entity';
import { ChecklistItem } from '../database/entities/checklist-item.entity';
import { Modificacao } from '../database/entities/modificacao.entity';
import { RepositoriosModule } from '../database/repositories/repositorios.module';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { CronogramaItensRepository } from './repositories/cronograma-itens.repository';
import { ChecklistItensRepository } from './repositories/checklist-itens.repository';
import { ModificacoesRepository } from './repositories/modificacoes.repository';
import { CronogramaItensService } from './cronograma-itens.service';
import { ChecklistItensService } from './checklist-itens.service';
import { ModificacoesService } from './modificacoes.service';
import { PlanoCronogramaService } from './plano-cronograma.service';
import { PlanoCronogramaController } from './plano-cronograma.controller';

/** Módulo-piloto da adequação ao Guia Mestre (Controller → Service → Repository) — ver
 * `docs/` deste módulo.
 *
 * `Projeto`/`Evento` NÃO entram mais no `forFeature` daqui: são entidades transversais e o
 * acesso a elas vem do `RepositoriosModule`. As três que sobraram são as que este módulo
 * realmente possui. */
@Module({
  imports: [
    TypeOrmModule.forFeature([CronogramaItem, ChecklistItem, Modificacao]),
    RepositoriosModule,
    CatalogosModule,
    DisponibilidadeModule,
  ],
  controllers: [PlanoCronogramaController],
  providers: [
    CronogramaItensRepository,
    ChecklistItensRepository,
    ModificacoesRepository,
    CronogramaItensService,
    ChecklistItensService,
    ModificacoesService,
    PlanoCronogramaService,
  ],
  exports: [CronogramaItensService, ChecklistItensService, ModificacoesService],
})
export class PlanoCronogramaModule {}
