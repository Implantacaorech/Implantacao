import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { IaController } from './ia.controller';
import { IaTelemetriaModule } from '../ia-telemetria/ia-telemetria.module';

// Importa o IaTelemetriaModule para o IaService registrar cada chamada (custo/tokens/quem).
// A dependência é numa direção só (Ia → Telemetria); o módulo de telemetria não conhece este.
@Module({
  imports: [IaTelemetriaModule],
  controllers: [IaController],
  providers: [IaService],
  exports: [IaService],
})
export class IaModule {}
