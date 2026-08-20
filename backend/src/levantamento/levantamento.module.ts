import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LevantamentoResposta } from '../database/entities/levantamento-resposta.entity';
import { DocConteudo } from '../database/entities/doc-conteudo.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { IaModule } from '../ia/ia.module';
import { ProtocolosModule } from '../protocolos/protocolos.module';
import { RepositoriosModule } from '../database/repositories/repositorios.module';
import { LevantamentoRespostaService } from './levantamento-resposta.service';
import { LevantamentoPresencaService } from './levantamento-presenca.service';
import { DocConteudoService } from './doc-conteudo.service';
import { HerancaProjetoService } from './heranca-projeto.service';
import { HerancaLevantamentoRepository } from './repositories/heranca-levantamento.repository';
import { SugestaoLevantamentoService } from './sugestao-levantamento.service';
import { LevantamentoController } from './levantamento.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LevantamentoResposta, DocConteudo, Projeto]),
    CatalogosModule,
    // Sugestão das respostas a partir da reunião gravada: a transcrição vem do Protocolo
    // (ProtocolosModule) e a leitura dela, da IA — cada uma com a sua finalidade/chave.
    IaModule,
    ProtocolosModule,
    // `Projeto` é entidade transversal: o acesso vem do repositório central, não de um
    // `forFeature` repetido aqui (ver database/repositories/projeto.repository.ts).
    RepositoriosModule,
  ],
  controllers: [LevantamentoController],
  providers: [
    LevantamentoRespostaService,
    LevantamentoPresencaService,
    DocConteudoService,
    HerancaProjetoService,
    HerancaLevantamentoRepository,
    SugestaoLevantamentoService,
  ],
  exports: [LevantamentoRespostaService, DocConteudoService, HerancaProjetoService],
})
export class LevantamentoModule {}
