import { Module } from '@nestjs/common';
import { DadosModule } from '../dados/dados.module';
import { RnsController } from './rns.controller';
import { RnsService } from './rns.service';

/** Tela **Execução → RNS** — consulta de assuntos nas RNS do SICLA, no molde do Dicionário
 * Inteligente: o consultor pesquisa um assunto e vê as RNS relacionadas (Pedido + Item).
 * Lê `SICLA.LISTA_ITEMPED` pela conexão Oracle do DadosModule (a mesma das
 * outras leituras do SICLA); o gate de menu é `rns`. */
@Module({
  imports: [DadosModule],
  controllers: [RnsController],
  providers: [RnsService],
})
export class RnsModule {}
