import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryCapacidadeDto {
  // CSV de siglas de módulo do cliente novo (ex.: "FAT,CTB"); vazio = visão geral.
  @ApiPropertyOptional() @IsOptional() @IsString() modulos?: string;

  // 2-12, default 6 — validado/clampado no controller (mesma regra de
  // webapp/routes_painel.py:capacidade).
  @ApiPropertyOptional() @IsOptional() @IsString() semanas?: string;
}
