import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class SalvarIndiceTopicoDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() id?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() moduloNum?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() moduloSigla?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adicionalNum?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adicionalSigla?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adicional?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() topico?: string;
}
