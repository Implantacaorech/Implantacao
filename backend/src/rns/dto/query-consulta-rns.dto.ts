import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Janela de CRIAÇÃO (`DATACRI`) da consulta de RNS. As duas datas são opcionais e passam
 * por saneamento no serviço (`RnsService.periodo`): ausente/inválida cai no default (mês
 * anterior → mês seguinte), invertida é ordenada, larga demais é aparada — por isso aqui
 * basta ser texto. */
export class QueryConsultaRnsDto {
  @ApiPropertyOptional({ description: 'Criadas a partir de (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  ini?: string;

  @ApiPropertyOptional({ description: 'Criadas até, INCLUSIVE (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  fim?: string;
}
