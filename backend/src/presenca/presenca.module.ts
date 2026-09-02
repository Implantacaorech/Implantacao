import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PresencaSessao } from '../database/entities/presenca-sessao.entity';
import { PresencaRepository } from './repositories/presenca.repository';
import { PresencaService } from './presenca.service';
import { PresencaController } from './presenca.controller';

/** Controle de acessos — presença ao vivo (docs/controle-acessos.md). */
@Module({
  imports: [TypeOrmModule.forFeature([PresencaSessao])],
  controllers: [PresencaController],
  providers: [PresencaRepository, PresencaService],
  exports: [PresencaService],
})
export class PresencaModule {}
