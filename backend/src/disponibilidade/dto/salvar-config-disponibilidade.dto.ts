import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SalvarConfigDisponibilidadeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() tipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() host?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() porta?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() banco?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() usuario?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() select?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() selectTecnicos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() oracleLibDir?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ativo?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() oracleThick?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() senha?: string;
}
