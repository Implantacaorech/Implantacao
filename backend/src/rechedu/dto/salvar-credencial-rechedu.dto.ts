import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Credencial do RechEdu do próprio consultor. A senha é opcional na EDIÇÃO (em branco
 * mantém a atual — mesma regra da credencial do Portal Rech). */
export class SalvarCredencialRecheduDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  login: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  senha?: string;
}
