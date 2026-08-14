import { Module } from '@nestjs/common';
import { RecheduController } from './rechedu.controller';
import { RecheduCredencialService } from './rechedu-credencial.service';

/** RechEdu — portal de educação da Rech (www.rechedu.com.br) emoldurado na tela
 * Execução → RechEdu. O módulo só guarda a credencial pessoal de cada consultor
 * (arquivo em `dados/`, como a do Portal Rech); o site em si roda no iframe. */
@Module({
  controllers: [RecheduController],
  providers: [RecheduCredencialService],
})
export class RecheduModule {}
