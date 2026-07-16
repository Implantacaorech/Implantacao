import { Module } from '@nestjs/common';
import { LegadoCliService } from './legado-cli.service';
import { LegadoDownloadRegistry } from './legado-download.registry';
import { LegadoService } from './legado.service';
import { LegadoController } from './legado.controller';

@Module({
  controllers: [LegadoController],
  providers: [LegadoCliService, LegadoDownloadRegistry, LegadoService],
  // LegadoCliService exportado para o FluxoModule reusar o gerador legado de Check List
  // no pacote inicial do Fluxo (ver FluxoService.criarComPacote) — LegadoService/Registry
  // ficam internos (só fazem sentido com o fluxo de download por token do /legado/*).
  exports: [LegadoCliService],
})
export class LegadoModule {}
