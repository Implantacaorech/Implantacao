import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryCapacidadeDto {
  // CSV de siglas de módulo do cliente novo (ex.: "FAT,CTB"); vazio = visão geral.
  @ApiPropertyOptional() @IsOptional() @IsString() modulos?: string;

  // 2-12, default 6 — validado/clampado no controller (mesma regra de
  // webapp/routes_painel.py:capacidade).
  @ApiPropertyOptional() @IsOptional() @IsString() semanas?: string;

  // Setor de atuação do técnico (`usuarios.setor_atuacao`, vindo de
  // SICLA.LISTA_TECNICOS.SETORDES). Vazio = todos os setores; `__sem__` = só quem está sem
  // setor no cadastro. Mesma convenção do filtro da tela de Usuários.
  @ApiPropertyOptional() @IsOptional() @IsString() setor?: string;
}
