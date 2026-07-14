import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SalvarModeloEmailDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assunto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() corpo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() etapa?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ativo?: boolean;
}
