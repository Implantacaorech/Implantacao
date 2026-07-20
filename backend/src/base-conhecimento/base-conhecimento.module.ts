import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SigerFonte } from '../database/entities/siger-fonte.entity';
import { BaseConhecimentoController } from './base-conhecimento.controller';
import { BaseConhecimentoService } from './base-conhecimento.service';

@Module({
  imports: [TypeOrmModule.forFeature([SigerFonte])],
  controllers: [BaseConhecimentoController],
  providers: [BaseConhecimentoService],
})
export class BaseConhecimentoModule {}
