import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../database/entities/usuario.entity';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { TecnicosSiclaController } from './tecnicos-sicla.controller';
import { TecnicosSiclaService } from './tecnicos-sicla.service';

/** Cadastro de Usuários alimentado por `SICLA.LISTA_TECNICOS` (reusa o motor Oracle da
 * Disponibilidade e grava direto na tabela `usuarios`). */
@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), DisponibilidadeModule],
  controllers: [TecnicosSiclaController],
  providers: [TecnicosSiclaService],
  exports: [TecnicosSiclaService],
})
export class TecnicosSiclaModule {}
