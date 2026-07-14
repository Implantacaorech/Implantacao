import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class SalvarModeloDocumentoCampoDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() id?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() secao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() placeholder?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rotulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() origem?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() obrigatorio?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() observacao?: string;
}
