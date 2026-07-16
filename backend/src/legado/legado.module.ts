import { Module } from '@nestjs/common';
import { LegadoCliService } from './legado-cli.service';
import { LegadoDownloadRegistry } from './legado-download.registry';
import { LegadoService } from './legado.service';
import { LegadoController } from './legado.controller';

@Module({
  controllers: [LegadoController],
  providers: [LegadoCliService, LegadoDownloadRegistry, LegadoService],
})
export class LegadoModule {}
