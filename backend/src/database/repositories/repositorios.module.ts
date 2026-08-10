import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evento } from '../entities/evento.entity';
import { Projeto } from '../entities/projeto.entity';
import { EventoRepository } from './evento.repository';
import { ProjetoRepository } from './projeto.repository';

/** Repositórios das entidades TRANSVERSAIS (usadas por vários módulos). Importe este
 * módulo em vez de declarar `TypeOrmModule.forFeature([Projeto])` de novo — assim o acesso
 * a `Projeto`/`Evento` tem um ponto único, como manda o Guia Mestre (§Responsabilidades:
 * persistência não se espalha por Service/Controller).
 *
 * Deliberadamente enxuto: só entra aqui entidade compartilhada. Entidade de um módulo só
 * tem o repository dentro do próprio módulo (`<modulo>/repositories/`). */
@Module({
  imports: [TypeOrmModule.forFeature([Projeto, Evento])],
  providers: [ProjetoRepository, EventoRepository],
  exports: [ProjetoRepository, EventoRepository],
})
export class RepositoriosModule {}
