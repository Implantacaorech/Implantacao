import { Module } from '@nestjs/common';
import { IaModule } from '../ia/ia.module';
import { ProntidaoController } from './prontidao.controller';
import { ProntidaoService } from './prontidao.service';

/** Módulo Prontidão do Sistema (Sistema → Prontidão). Depende do IaModule para o sinal ao vivo
 * de privacidade (avisosPrivacidade). Sem TypeOrmModule: o módulo não persiste nada. */
@Module({
  imports: [IaModule],
  controllers: [ProntidaoController],
  providers: [ProntidaoService],
})
export class ProntidaoModule {}
