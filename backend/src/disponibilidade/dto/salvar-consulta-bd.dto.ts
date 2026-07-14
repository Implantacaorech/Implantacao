import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class SalvarConsultaBdDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sql?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() ordem?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() colunaData?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colunaSituacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mostrarGrafico?: boolean;
}
