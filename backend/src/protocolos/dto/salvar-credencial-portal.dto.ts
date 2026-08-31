import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Credencial do Portal Rech do próprio consultor. A senha é opcional na EDIÇÃO (em branco
 * mantém a atual — mesma regra da Disponibilidade). */
export class SalvarCredencialPortalDto {
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
