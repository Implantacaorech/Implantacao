import { Module } from '@nestjs/common';
import { AutomacaoController } from './automacao.controller';
import { AutomacaoService } from './automacao.service';

/** Kill switch de runtime (eixo 4). Sem repositório: o estado é um arquivo em `dados/`,
 * gerido pelo singleton `killSwitch` que IaService e os robôs consultam direto. */
@Module({
  controllers: [AutomacaoController],
  providers: [AutomacaoService],
})
export class AutomacaoModule {}
