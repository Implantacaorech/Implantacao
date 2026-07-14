import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatrizCompetencia } from '../database/entities/matriz-competencia.entity';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { MatrizService } from './matriz.service';
import { MatrizController } from './matriz.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MatrizCompetencia, MatrizTecnico])],
  controllers: [MatrizController],
  providers: [MatrizService],
  exports: [MatrizService],
})
export class MatrizModule {}
