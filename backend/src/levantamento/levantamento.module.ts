import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LevantamentoResposta } from '../database/entities/levantamento-resposta.entity';
import { DocConteudo } from '../database/entities/doc-conteudo.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { LevantamentoRespostaService } from './levantamento-resposta.service';
import { DocConteudoService } from './doc-conteudo.service';
import { LevantamentoController } from './levantamento.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LevantamentoResposta, DocConteudo, Projeto]),
    CatalogosModule,
  ],
  controllers: [LevantamentoController],
  providers: [LevantamentoRespostaService, DocConteudoService],
  exports: [LevantamentoRespostaService, DocConteudoService],
})
export class LevantamentoModule {}
