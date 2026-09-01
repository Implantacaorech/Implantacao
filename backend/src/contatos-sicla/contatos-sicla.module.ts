import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../database/entities/usuario.entity';
import { DadosModule } from '../dados/dados.module';
import { ContatosSiclaController } from './contatos-sicla.controller';
import { ContatosSiclaService } from './contatos-sicla.service';
import { AcessoClienteRepository } from './repositories/acesso-cliente.repository';

/** Acesso de Clientes: contatos do SICLA (`LISTA_CONTATOS`, liberados por
 * `PORTAL_RECH_CLIENTES = 1`) que recebem conta no Painel com papel `Cliente`.
 *
 * Exporta o serviço porque o login o consulta: o usuário-cliente é revalidado contra o
 * SICLA a cada entrada (docs/acesso-cliente-bi.md §10). */
@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), DadosModule],
  controllers: [ContatosSiclaController],
  providers: [ContatosSiclaService, AcessoClienteRepository],
  exports: [ContatosSiclaService],
})
export class ContatosSiclaModule {}
