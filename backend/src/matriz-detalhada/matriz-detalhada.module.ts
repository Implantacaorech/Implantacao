import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DicionarioDocumento } from '../database/entities/dicionario-documento.entity';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { MatrizModule } from '../matriz/matriz.module';
import { MenusSigerService } from './menus-siger.service';
import { MatrizDetalhadaService } from './matriz-detalhada.service';
import { MatrizDetalhadaController } from './matriz-detalhada.controller';

/** Matriz de Conhecimento DETALHADA (por menu do SIGER). Reusa MatrizService (lista/linha
 * do técnico + regra de linha) e o Dicionário (taxonomia dos menus). */
@Module({
  imports: [
    TypeOrmModule.forFeature([DicionarioDocumento, MatrizTecnico]),
    MatrizModule,
  ],
  controllers: [MatrizDetalhadaController],
  providers: [MenusSigerService, MatrizDetalhadaService],
})
export class MatrizDetalhadaModule {}
