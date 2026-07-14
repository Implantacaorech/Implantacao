import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../database/entities/usuario.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { Evento } from '../database/entities/evento.entity';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { MatrizModule } from '../matriz/matriz.module';
import { MetricasModule } from '../metricas/metricas.module';
import { DigestModule } from '../digest/digest.module';
import { CapacidadeService } from './capacidade.service';
import { CoordenacaoService } from './coordenacao.service';
import { AtividadeService } from './atividade.service';
import { HomeService } from './home.service';
import { PainelController } from './painel.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Projeto, Documento, Evento, AtividadeCronograma]),
    DisponibilidadeModule,
    MatrizModule,
    MetricasModule,
    DigestModule,
  ],
  controllers: [PainelController],
  providers: [CapacidadeService, CoordenacaoService, AtividadeService, HomeService],
})
export class PainelModule {}
