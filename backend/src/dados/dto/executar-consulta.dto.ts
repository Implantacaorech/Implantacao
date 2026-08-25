import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { TAMANHO_PAGINA_MAX } from '../catalogo/catalogo';

/** Corpo do POST que executa uma consulta do catálogo.
 *
 * Note o que NÃO existe aqui: `sql`, `conexao`, `limite`. Os três são do servidor — é essa
 * ausência que faz a regra "toda consulta a banco passa por uma API" valer de fato, em vez
 * de mudar só o transporte do mesmo SQL solto. */
export class ExecutarConsultaDto {
  @ApiPropertyOptional({
    description:
      'Parâmetros da consulta, por nome do bind. O contrato de cada um está em GET /api/dados/v1/consultas/{nome}.',
    example: { data_ini: '2026-08-01', data_fim: '2026-08-31' },
  })
  @IsOptional()
  @IsObject()
  parametros?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Página (1-based).', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({
    description: `Linhas por página (teto ${TAMANHO_PAGINA_MAX}).`,
    default: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANHO_PAGINA_MAX)
  tamanho?: number;
}
