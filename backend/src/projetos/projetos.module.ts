import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { CronogramaModule } from '../cronograma/cronograma.module';
import { LevantamentoModule } from '../levantamento/levantamento.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { EmailModule } from '../email/email.module';
import { PassosModule } from '../passos/passos.module';
import { ProjetosController } from './projetos.controller';
import { ProjetosService } from './projetos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Projeto]),
    CronogramaModule,
    LevantamentoModule,
    DocumentosModule,
    EmailModule,
    // Editar `gci`/`consultor` na ficha refaz os vínculos com `usuario_id` — é lá que a
    // RN-10 lê a designação (ver ProjetosService.atualizar).
    PassosModule,
  ],
  controllers: [ProjetosController],
  providers: [ProjetosService],
  exports: [ProjetosService],
})
export class ProjetosModule {}
