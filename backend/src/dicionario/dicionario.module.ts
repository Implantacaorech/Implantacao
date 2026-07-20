import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DicionarioDocumento } from '../database/entities/dicionario-documento.entity';
import { IaModule } from '../ia/ia.module';
import { DicionarioController } from './dicionario.controller';
import { DicionarioService } from './dicionario.service';
import { DicionarioIaService } from './dicionario-ia.service';

@Module({
  imports: [TypeOrmModule.forFeature([DicionarioDocumento]), IaModule],
  controllers: [DicionarioController],
  providers: [DicionarioService, DicionarioIaService],
})
export class DicionarioModule {}
