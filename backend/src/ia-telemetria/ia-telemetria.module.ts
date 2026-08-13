import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecucaoIa } from '../database/entities/execucao-ia.entity';
import { IaTelemetriaController } from './ia-telemetria.controller';
import { IaTelemetriaService } from './ia-telemetria.service';
import { ExecucaoIaRepository } from './repositories/execucao-ia.repository';

/**
 * Telemetria de IA (A9/A10). Exporta o `IaTelemetriaService` para o `IaModule` registrar cada
 * chamada. NÃO importa o IaModule — a dependência é numa direção só (Ia → Telemetria), sem
 * ciclo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ExecucaoIa])],
  controllers: [IaTelemetriaController],
  providers: [IaTelemetriaService, ExecucaoIaRepository],
  exports: [IaTelemetriaService],
})
export class IaTelemetriaModule {}
