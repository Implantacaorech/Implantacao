import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenteExecucao } from '../database/entities/agente-execucao.entity';
import { AgentesController } from './agentes.controller';
import { AgentesService } from './agentes.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgenteExecucao])],
  controllers: [AgentesController],
  providers: [AgentesService],
})
export class AgentesModule {}
