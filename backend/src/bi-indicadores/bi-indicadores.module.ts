import { Module } from '@nestjs/common';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { BiIndicadoresService } from './bi-indicadores.service';
import { BiIndicadoresController } from './bi-indicadores.controller';

/** Indicadores da aba **BI Implantação** (porte do `BI_Interno.pbix`). Lê
 * `POWERBI.POWERBI_IMP_RNIMPLANTACAO_2` pela conexão Oracle do DisponibilidadeModule. */
@Module({
  imports: [DisponibilidadeModule],
  controllers: [BiIndicadoresController],
  providers: [BiIndicadoresService],
  exports: [BiIndicadoresService],
})
export class BiIndicadoresModule {}
