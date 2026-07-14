import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class SalvarChecklistModeloDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() id?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() modulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adicional?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() integracoes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() golive?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() menu?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() item?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() acao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() seq?: string;
}
