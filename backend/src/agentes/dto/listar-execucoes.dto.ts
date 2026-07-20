import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class ListarExecucoesDto {
  @ApiPropertyOptional({ description: 'true = só execuções em andamento' })
  @IsOptional()
  @IsBooleanString()
  ativos?: string;

  @ApiPropertyOptional({ default: '50' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value)
  limite?: string;
}
