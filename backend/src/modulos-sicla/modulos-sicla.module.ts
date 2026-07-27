import { Module } from '@nestjs/common';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { ModulosSiclaController } from './modulos-sicla.controller';
import { ModulosSiclaService } from './modulos-sicla.service';

/** Passo 1: consulta de módulos/adicionais no SICLA (reusa o motor Oracle da
 * Disponibilidade) para marcar os módulos contratados. */
@Module({
  imports: [DisponibilidadeModule],
  controllers: [ModulosSiclaController],
  providers: [ModulosSiclaService],
})
export class ModulosSiclaModule {}
