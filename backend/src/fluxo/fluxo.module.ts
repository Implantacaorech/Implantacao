import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { DocumentosModule } from '../documentos/documentos.module';
import { EmailModule } from '../email/email.module';
import { LegadoModule } from '../legado/legado.module';
import { ImapIntakeService } from './imap-intake.service';
import { FluxoService } from './fluxo.service';
import { RoboCaixaService } from './robo-caixa.service';
import { ConfigImapController } from './config-imap.controller';
import { FluxoController } from './fluxo.controller';
import { ProjetoEmailService } from './projeto-email.service';
import { ProjetoEmailController } from './projeto-email.controller';
import { PassosModule } from '../passos/passos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Projeto]),
    DocumentosModule,
    EmailModule,
    LegadoModule,
    PassosModule,
  ],
  controllers: [ConfigImapController, FluxoController, ProjetoEmailController],
  providers: [
    ImapIntakeService,
    FluxoService,
    RoboCaixaService,
    ProjetoEmailService,
  ],
  exports: [ImapIntakeService, FluxoService],
})
export class FluxoModule {}
