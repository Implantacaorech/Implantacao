import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import { ProjetoPasso } from '../database/entities/projeto-passo.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { ProjetoRns } from '../database/entities/projeto-rns.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { PassosController } from './passos.controller';
import { PassosPainelController } from './passos-painel.controller';
import { DestinatariosPassoController } from './destinatarios-passo.controller';
import { PassosService } from './passos.service';
import { RnsService } from './rns.service';
import { PassosNotificacaoService } from './passos-notificacao.service';
import { DestinatariosPassoService } from './destinatarios-passo.service';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { Documento } from '../database/entities/documento.entity';
import { DestinatarioPassoConfig } from '../database/entities/destinatario-passo.entity';
import { EmailPasso } from '../database/entities/email-passo.entity';
import { ModeloEmail } from '../database/entities/modelo-email.entity';

/** Os 21 passos operacionais do processo de implantação (revisão de 2026-07-30), os
 * vínculos de pessoas por papel e as RNS do projeto. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Projeto,
      Evento,
      ProjetoPasso,
      ProjetoPessoa,
      ProjetoRns,
      Documento,
      DestinatarioPassoConfig,
      EmailPasso,
      ModeloEmail,
      // Resolver nome -> id ao gravar a designação (PassosService.idsPorNome).
      Usuario,
    ]),
    UsersModule,
    EmailModule,
    forwardRef(() => DocumentosModule),
  ],
  controllers: [
    PassosController,
    PassosPainelController,
    DestinatariosPassoController,
  ],
  providers: [
    PassosService,
    RnsService,
    PassosNotificacaoService,
    DestinatariosPassoService,
  ],
  exports: [
    PassosService,
    RnsService,
    PassosNotificacaoService,
    DestinatariosPassoService,
  ],
})
export class PassosModule {}
