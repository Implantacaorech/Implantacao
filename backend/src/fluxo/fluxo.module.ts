import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { DocumentosModule } from '../documentos/documentos.module';
import { EmailModule } from '../email/email.module';
import { ImapIntakeService } from './imap-intake.service';
import { FluxoService } from './fluxo.service';
import { RoboCaixaService } from './robo-caixa.service';
import { ConfigImapController } from './config-imap.controller';
import { FluxoController } from './fluxo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Projeto]), DocumentosModule, EmailModule],
  controllers: [ConfigImapController, FluxoController],
  providers: [ImapIntakeService, FluxoService, RoboCaixaService],
  exports: [ImapIntakeService, FluxoService],
})
export class FluxoModule {}
