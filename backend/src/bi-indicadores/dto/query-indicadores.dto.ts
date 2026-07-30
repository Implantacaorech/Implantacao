import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/** Só converte primitivo: `String()` num objeto vindo da query daria "[object Object]".
 * Mesma guarda de `bi-implantacao/dto/query-resumo.dto.ts`. */
const comoTexto = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : '';

/** Aceita `?posicao=a&posicao=b` e `?posicao=a` (valor único). */
const comoLista = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value.map(comoTexto) : [comoTexto(value)];
};

export class QueryIndicadoresDto {
  @ApiPropertyOptional({ description: 'Competência inicial (AAAA-MM)' })
  @IsOptional()
  @IsString()
  compIni?: string;

  @ApiPropertyOptional({ description: 'Competência final (AAAA-MM)' })
  @IsOptional()
  @IsString()
  compFim?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Posição da implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  posicao?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tipo de implantação' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tipoImplantacao?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Área' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  area?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tipo de suporte' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tipoSuporte?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Responsáveis' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  responsavel?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Grupos econômicos' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  grupo?: string[];
}
