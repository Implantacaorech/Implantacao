import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SalvarNotasMenuDto {
  // "SIGLA|codigo" -> nota (string "0".."10"; vazio remove). Ex.: { "GIN|2.1-P": "8" }.
  @ApiProperty({ type: Object })
  @IsObject()
  notas: Record<string, string>;
}
