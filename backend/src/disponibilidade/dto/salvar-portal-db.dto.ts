import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** Cadastro da conexão com o banco do Portal Rech (Sistema → Consulta BD). Senha em
 * branco MANTÉM a atual (mesma regra da Disponibilidade). */
export class SalvarPortalDbDto {
  @ApiPropertyOptional() @IsOptional() @IsString() host?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() porta?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() banco?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() usuario?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() senha?: string;
  @ApiPropertyOptional({
    description:
      'URL completa (mysql://usuario:senha@host:porta/banco) — prevalece',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() ativo?: boolean;
}
