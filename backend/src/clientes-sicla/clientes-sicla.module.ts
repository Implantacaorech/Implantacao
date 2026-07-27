import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { PassosModule } from '../passos/passos.module';
import { ClientesSiclaController } from './clientes-sicla.controller';
import { ClientesSiclaService } from './clientes-sicla.service';

/** Passo 1 do processo: consulta do cliente no SICLA (reusa o motor Oracle da
 * Disponibilidade) e cadastro da ficha (conclui o passo 1 via PassosModule). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Projeto]),
    DisponibilidadeModule,
    PassosModule,
  ],
  controllers: [ClientesSiclaController],
  providers: [ClientesSiclaService],
})
export class ClientesSiclaModule {}
