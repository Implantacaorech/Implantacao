import { Module } from '@nestjs/common';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { BiMovimentosService } from './bi-movimentos.service';
import { BiMovimentosController } from './bi-movimentos.controller';

/** "Movimentos de trabalho efetivo" da aba **BI Implantação** (porte do `BI_Interno.pbix`).
 * Lê `POWERBI_APONTAMENTO_TECNICOS` (663 mil linhas, sem índice) pela conexão Oracle do
 * DisponibilidadeModule, sempre agregada no próprio Oracle — ver bi-movimentos.constants.ts. */
@Module({
  imports: [DisponibilidadeModule],
  controllers: [BiMovimentosController],
  providers: [BiMovimentosService],
  exports: [BiMovimentosService],
})
export class BiMovimentosModule {}
