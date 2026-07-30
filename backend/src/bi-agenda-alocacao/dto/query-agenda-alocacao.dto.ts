import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/** Só converte primitivo: `String()` num objeto vindo da query daria "[object Object]".
 * Mesma guarda de `bi-implantacao/dto/query-resumo.dto.ts`. */
const comoTexto = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : '';

/** Aceita `?grupo=a&grupo=b` e `?grupo=a` (valor único). */
const comoLista = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value.map(comoTexto) : [comoTexto(value)];
};

export class QueryCalendarioAlocacaoDto {
  @ApiPropertyOptional({ description: 'Mês do calendário (AAAA-MM)' })
  @IsOptional()
  @IsString()
  mes?: string;

  @ApiPropertyOptional({ type: [String], description: 'Grupos econômicos' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  grupo?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Técnico do compromisso',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  responsavel?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tipo de suporte' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tipoSuporte?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Status do compromisso' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  status?: string[];
}

export class QueryHorasAplicadasDto {
  @ApiPropertyOptional({ description: 'Competência inicial (AAAA-MM)' })
  @IsOptional()
  @IsString()
  compIni?: string;

  @ApiPropertyOptional({ description: 'Competência final (AAAA-MM)' })
  @IsOptional()
  @IsString()
  compFim?: string;

  @ApiPropertyOptional({ type: [String], description: 'Grupos econômicos' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  grupo?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Responsável da RNS de implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  responsavel?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tipo de suporte' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tipoSuporte?: string[];
}
