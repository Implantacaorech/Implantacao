import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';
import { SlotCronograma } from '../database/entities/slot-cronograma.entity';
import { CronogramaConfig } from '../database/entities/cronograma-config.entity';
import { CronogramaPeriodoBloqueado } from '../database/entities/cronograma-periodo-bloqueado.entity';
import { Designacao } from '../database/entities/designacao.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { GeracaoModule } from '../geracao/geracao.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { CronogramaService } from './cronograma.service';
import { DesignacoesService } from './designacoes.service';
import { DistribuicaoService } from './distribuicao.service';
import { CronogramaController } from './cronograma.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AtividadeCronograma,
      SlotCronograma,
      CronogramaConfig,
      CronogramaPeriodoBloqueado,
      Designacao,
      Projeto,
      // A equipe do passo 8 (GCI + técnicos) mora em `projeto_pessoas` — é dela que sai a
      // lista de técnicos oferecida no Agendador (`DesignacoesService.tecnicosDoProjeto`).
      ProjetoPessoa,
    ]),
    CatalogosModule,
    GeracaoModule,
    DocumentosModule,
    EmailModule,
    UsersModule,
    DisponibilidadeModule,
  ],
  controllers: [CronogramaController],
  providers: [CronogramaService, DesignacoesService, DistribuicaoService],
  exports: [CronogramaService, DesignacoesService, DistribuicaoService],
})
export class CronogramaModule {}
