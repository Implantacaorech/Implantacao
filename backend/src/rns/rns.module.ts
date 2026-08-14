import { Module } from '@nestjs/common';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { RnsController } from './rns.controller';
import { RnsService } from './rns.service';

/** Tela **Execução → RNS** — consulta de assuntos nas RNS do SICLA, no molde do Dicionário
 * Inteligente: o consultor pesquisa um assunto e vê as RNS relacionadas (Pedido + Item).
 * Lê `SICLA.LISTA_ITEMPED` pela conexão Oracle do DisponibilidadeModule (a mesma das
 * outras leituras do SICLA); o gate de menu é `rns`. */
@Module({
  imports: [DisponibilidadeModule],
  controllers: [RnsController],
  providers: [RnsService],
})
export class RnsModule {}
