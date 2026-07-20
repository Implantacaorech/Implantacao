import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PesquisarSigerDto {
  @ApiPropertyOptional({ description: 'Termo pesquisado no caminho e no conteúdo indexado' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  q?: string;
}
