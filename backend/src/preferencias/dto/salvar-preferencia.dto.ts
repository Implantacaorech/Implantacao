import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';

export class SalvarPreferenciaDto {
  /** Estado dos filtros da tela. O formato é da TELA — o backend só transporta e guarda o
   * JSON. Sem `@ValidateNested` de propósito: não há esquema fixo a validar aqui, e o
   * `whitelist` do ValidationPipe só poda o nível de cima (este objeto passa intacto). */
  @ApiProperty({
    description: 'Estado dos filtros da tela (JSON livre)',
    example: { setor: 'GRM-Implantação', modulos: 'FAT, CTB', semanas: 6 },
  })
  @IsDefined()
  valor: unknown;
}
