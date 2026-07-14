import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { CronogramaModule } from '../cronograma/cronograma.module';
import { LevantamentoModule } from '../levantamento/levantamento.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { ProjetosController } from './projetos.controller';
import { ProjetosService } from './projetos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Projeto]), CronogramaModule, LevantamentoModule, DocumentosModule],
  controllers: [ProjetosController],
  providers: [ProjetosService],
  exports: [ProjetosService],
})
export class ProjetosModule {}
