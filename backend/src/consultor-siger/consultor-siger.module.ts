import { Module } from '@nestjs/common';
import { ConsultorSigerController } from './consultor-siger.controller';
import { ConsultorSigerService } from './consultor-siger.service';

/** Tela **Execução → Consultor SIGER** — base inteligente de conhecimento do SIGER para os
 * Consultores de Implantação, irmã do Wall-e no desenho (fonte externa SOMENTE LEITURA →
 * base pesquisável → tela de consulta). A diferença deliberada: aqui a base derivada é um
 * SQLite gerado pelo indexador FORA deste repositório (F:\CONSULTOR-SIGER — ver
 * docs/arquitetura.md, decisão registrada) e o Painel a abre em modo somente leitura; a
 * fonte original `F:\SIGER` nunca é acessada pelo Painel. Gate de menu: `consultor_siger`. */
@Module({
  controllers: [ConsultorSigerController],
  providers: [ConsultorSigerService],
})
export class ConsultorSigerModule {}
