import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class QueryDashboardDto {
  @ApiPropertyOptional() @IsOptional() @IsString() ref?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() direcao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() n?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  situacao?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() mesSel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() anoSel?: string;
}
