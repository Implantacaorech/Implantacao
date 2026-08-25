import { Module } from '@nestjs/common';
import { DadosModule } from '../dados/dados.module';
import { ModulosSiclaController } from './modulos-sicla.controller';
import { ModulosSiclaService } from './modulos-sicla.service';

/** Passo 1: consulta de módulos/adicionais no SICLA, pela API de Dados (ADR-0003), para
 * marcar os módulos contratados. */
@Module({
  imports: [DadosModule],
  controllers: [ModulosSiclaController],
  providers: [ModulosSiclaService],
})
export class ModulosSiclaModule {}
