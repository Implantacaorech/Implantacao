import { Module } from '@nestjs/common';
import { DadosModule } from '../dados/dados.module';
import { BiIndicadoresService } from './bi-indicadores.service';
import { BiIndicadoresController } from './bi-indicadores.controller';

/** Indicadores da aba **BI Implantação** (porte do `BI_Interno.pbix`). Lê
 * `POWERBI.POWERBI_IMP_RNIMPLANTACAO_2` pela conexão Oracle do DadosModule. */
@Module({
  imports: [DadosModule],
  controllers: [BiIndicadoresController],
  providers: [BiIndicadoresService],
  exports: [BiIndicadoresService],
})
export class BiIndicadoresModule {}
