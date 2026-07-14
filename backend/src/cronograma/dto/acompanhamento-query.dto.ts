import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AcompanhamentoQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() data?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tecnico?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}
