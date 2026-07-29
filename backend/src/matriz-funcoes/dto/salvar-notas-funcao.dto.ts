import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SalvarNotasFuncaoDto {
  // "SIGLA|codigo" -> nota (string "0".."10"; vazio remove). Ex.: { "CTB|3004": "8" }.
  @ApiProperty({ type: Object })
  @IsObject()
  notas: Record<string, string>;
}
