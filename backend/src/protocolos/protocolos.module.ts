import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Protocolo } from '../database/entities/protocolo.entity';
import { IaModule } from '../ia/ia.module';
import { TranscricaoModule } from '../transcricao/transcricao.module';
import { ProtocolosService } from './protocolos.service';
import { ProtocoloIaService } from './protocolo-ia.service';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { RoboProtocolosService } from './robo-protocolos.service';
import { ProtocolosController } from './protocolos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Protocolo]), IaModule, TranscricaoModule],
  controllers: [ProtocolosController],
  providers: [
    ProtocolosService,
    ProtocoloIaService,
    ProcessamentoProtocolosService,
    RoboProtocolosService,
  ],
  exports: [
    ProtocolosService,
    ProtocoloIaService,
    ProcessamentoProtocolosService,
  ],
})
export class ProtocolosModule {}
