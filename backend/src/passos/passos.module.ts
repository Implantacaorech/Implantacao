import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import { ProjetoPasso } from '../database/entities/projeto-passo.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { ProjetoRns } from '../database/entities/projeto-rns.entity';
import { PassosController } from './passos.controller';
import { PassosPainelController } from './passos-painel.controller';
import { PassosService } from './passos.service';
import { RnsService } from './rns.service';
import { PassosNotificacaoService } from './passos-notificacao.service';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { DocumentosModule } from '../documentos/documentos.module';

/** Os 18 passos operacionais do processo de implantação (revisão de 2026-07-22), os
 * vínculos de pessoas por papel e as RNS do projeto. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Projeto,
      Evento,
      ProjetoPasso,
      ProjetoPessoa,
      ProjetoRns,
    ]),
    UsersModule,
    EmailModule,
    forwardRef(() => DocumentosModule),
  ],
  controllers: [PassosController, PassosPainelController],
  providers: [PassosService, RnsService, PassosNotificacaoService],
  exports: [PassosService, RnsService, PassosNotificacaoService],
})
export class PassosModule {}
