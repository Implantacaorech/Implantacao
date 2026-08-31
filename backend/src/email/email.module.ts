import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModeloEmail } from '../database/entities/modelo-email.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import { UsersModule } from '../users/users.module';
import { MailerService } from './mailer.service';
import { GraphService } from './graph.service';
import { ModeloEmailService } from './modelo-email.service';
import { NotificacaoService } from './notificacao.service';
import { ConfigEmailController } from './config-email.controller';
import { ConfigGraphController } from './config-graph.controller';
import { ModeloEmailController } from './modelo-email.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModeloEmail, Projeto, Evento]),
    UsersModule,
  ],
  controllers: [
    ConfigEmailController,
    ConfigGraphController,
    ModeloEmailController,
  ],
  providers: [
    MailerService,
    GraphService,
    ModeloEmailService,
    NotificacaoService,
  ],
  exports: [
    MailerService,
    GraphService,
    ModeloEmailService,
    NotificacaoService,
  ],
})
export class EmailModule {}
