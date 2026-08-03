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
  // Exportado para a gravação de reunião (ProtocolosModule) usar a MESMA busca de cliente
  // do passo 1 — o SICLA é a fonte única de quem é cliente, e o SQL é o mesmo (editável
  // pelo Administrador em Consultas BD).
  exports: [ClientesSiclaService],
})
export class ClientesSiclaModule {}
