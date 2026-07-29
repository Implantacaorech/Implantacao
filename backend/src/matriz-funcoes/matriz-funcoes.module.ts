import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { MatrizModule } from '../matriz/matriz.module';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { FuncoesSiclaService } from './funcoes-sicla.service';
import { MatrizFuncoesService } from './matriz-funcoes.service';
import { MatrizFuncoesController } from './matriz-funcoes.controller';

/** Matriz por Menu — FUNÇÕES SICLA. Mesma estrutura da Matriz por Menu do Dicionário
 * (reusa MatrizService para lista/linha do técnico e a regra de linha), mas a taxonomia vem
 * de `SICLA.LISTA_FUNCOES` pelo motor Oracle da Disponibilidade. */
@Module({
  imports: [
    TypeOrmModule.forFeature([MatrizTecnico]),
    MatrizModule,
    DisponibilidadeModule,
  ],
  controllers: [MatrizFuncoesController],
  providers: [FuncoesSiclaService, MatrizFuncoesService],
})
export class MatrizFuncoesModule {}
