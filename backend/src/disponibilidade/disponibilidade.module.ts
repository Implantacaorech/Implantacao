import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultaBD } from '../database/entities/consulta-bd.entity';
import { DisponibilidadeService } from './disponibilidade.service';
import { ConsultaBdService } from './consulta-bd.service';
import { DashboardsService } from './dashboards.service';
import { ConfigDisponibilidadeController } from './config-disponibilidade.controller';
import { ConfigConsultasBdController } from './config-consultas-bd.controller';
import { DashboardsController } from './dashboards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConsultaBD])],
  controllers: [ConfigDisponibilidadeController, ConfigConsultasBdController, DashboardsController],
  providers: [DisponibilidadeService, ConsultaBdService, DashboardsService],
  exports: [DisponibilidadeService, ConsultaBdService, DashboardsService],
})
export class DisponibilidadeModule {}
