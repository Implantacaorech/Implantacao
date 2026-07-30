import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/** Só converte primitivo: `String()` num objeto vindo da query daria "[object Object]".
 * Mesma guarda de `bi-implantacao/dto/query-resumo.dto.ts`. */
const comoTexto = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : '';

/** Aceita `?tecnico=a&tecnico=b` e `?tecnico=a` (valor único). */
const comoLista = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value.map(comoTexto) : [comoTexto(value)];
};

export class QueryMovimentosDto {
  @ApiPropertyOptional({ description: 'Data inicial (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataIni?: string;

  @ApiPropertyOptional({ description: 'Data final (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataFim?: string;

  @ApiPropertyOptional({ type: [String], description: 'Técnicos' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tecnico?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tipo de movimento' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tpMovimento?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Cobra hora (Sim/Não)' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  cobraHora?: string[];
}
