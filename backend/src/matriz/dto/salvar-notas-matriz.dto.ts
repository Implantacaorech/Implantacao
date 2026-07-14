import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class SalvarNotasMatrizDto {
  @ApiPropertyOptional() @IsOptional() @IsString() setor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dias?: string;

  // sigla -> nota (string; "0".."10", aceita vírgula decimal; vazio remove a nota).
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  notas?: Record<string, string>;
}
