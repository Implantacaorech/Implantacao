import { Module } from '@nestjs/common';
import { DadosModule } from '../dados/dados.module';
import { DisponibilidadeService } from './disponibilidade.service';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';

/** Disponibilidade dos consultores — domínio puro desde a fase 2 do ADR-0003, e desde
 * 2026-08-26 **só** domínio: as três telas de configuração que moravam aqui saíram.
 *
 * - `config/consultas-bd` mudou para `dados/`, porque passou a ser exclusiva do Portal API;
 * - `config/disponibilidade` e `config/portal-db` foram REMOVIDAS: cadastrar conexão agora
 *   é `/api/dados/v1/admin/conexoes`, que existe na instância que de fato tem a credencial.
 *   Manter as duas seria manter dois lugares para a mesma verdade, num deles sem tela. */
@Module({
  imports: [DadosModule],
  controllers: [DashboardsController],
  providers: [DisponibilidadeService, DashboardsService],
  exports: [DisponibilidadeService, DashboardsService],
})
export class DisponibilidadeModule {}
