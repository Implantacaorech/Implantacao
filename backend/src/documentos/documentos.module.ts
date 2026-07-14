import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Documento } from '../database/entities/documento.entity';
import { Evento } from '../database/entities/evento.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { LevantamentoModule } from '../levantamento/levantamento.module';
import { GeracaoModule } from '../geracao/geracao.module';
import { EmailModule } from '../email/email.module';
import { DocumentosService } from './documentos.service';
import { GeracaoLayoutService } from './geracao-layout.service';
import { DocumentosController } from './documentos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Documento, Evento, Projeto]),
    CatalogosModule,
    LevantamentoModule,
    GeracaoModule,
    EmailModule,
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService, GeracaoLayoutService],
  exports: [DocumentosService, GeracaoLayoutService],
})
export class DocumentosModule {}
