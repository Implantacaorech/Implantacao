import { Module } from '@nestjs/common';
import { DadosModule } from '../dados/dados.module';
import { DisponibilidadeService } from './disponibilidade.service';
import { DashboardsService } from './dashboards.service';
import { ConfigDisponibilidadeController } from './config-disponibilidade.controller';
import { ConfigConsultasBdController } from './config-consultas-bd.controller';
import { ConfigPortalDbController } from './config-portal-db.controller';
import { DashboardsController } from './dashboards.controller';

@Module({
  imports: [DadosModule],
  controllers: [
    ConfigDisponibilidadeController,
    ConfigConsultasBdController,
    ConfigPortalDbController,
    DashboardsController,
  ],
  providers: [DisponibilidadeService, DashboardsService],
  exports: [DisponibilidadeService, DashboardsService],
})
export class DisponibilidadeModule {}
