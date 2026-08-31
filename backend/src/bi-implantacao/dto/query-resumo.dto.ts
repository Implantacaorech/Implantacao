import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/** Aceita tanto `?status=a&status=b` quanto `?status=a` (valor único) — o Angular manda os
 * dois formatos dependendo da quantidade selecionada. */
/** Só converte o que a query string de fato produz (texto e número). Qualquer outra coisa
 * vira string vazia em vez de "[object Object]" — `String(objeto)` daria isso, e o valor
 * inútil seguiria adiante como se fosse filtro válido. */
const comoTexto = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : '';

const comoLista = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value.map(comoTexto) : [comoTexto(value)];
};

export class QueryResumoDto {
  @ApiPropertyOptional({ description: 'Início do período (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataIni?: string;

  @ApiPropertyOptional({ description: 'Fim do período (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataFim?: string;

  @ApiPropertyOptional({ type: [String], description: 'Grupos econômicos' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  grupo?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Status da RNS (TIPOSTATUS)',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Consultores responsáveis',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tecnico?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Cliente ativo (Sim/Não)',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  ativo?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tipo do cliente' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tipoCliente?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Códigos de RNS de implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  rns?: string[];
}

export class QueryExtratoDto {
  @ApiPropertyOptional({ description: 'Início do período (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataIni?: string;

  @ApiPropertyOptional({ description: 'Fim do período (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataFim?: string;

  @ApiPropertyOptional({ type: [String], description: 'Grupos econômicos' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  grupo?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Consultores (LIS_TECNICODESCRICAO)',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tecnico?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Siglas de módulo do SIGER',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  sigla?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Clientes (nome fantasia)',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  cliente?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Códigos de RNS de implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  rns?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Status da RNS de implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  status?: string[];
}

export class QueryRnsDto {
  @ApiPropertyOptional({ description: 'Início do período (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataIni?: string;

  @ApiPropertyOptional({ description: 'Fim do período (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataFim?: string;

  @ApiPropertyOptional({ type: [String], description: 'Grupos econômicos' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  grupo?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Status da RNS' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Consultores da implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tecnico?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Siglas de módulo' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  sigla?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tipos de RNS' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tipo?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Status da RNS de implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  statusImplantacao?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Códigos de RNS de implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  rns?: string[];

  @ApiPropertyOptional({
    description: "Validada pelo cliente: 'sim', 'nao' ou vazio",
  })
  @IsOptional()
  @IsString()
  validada?: string;
}

export class QueryAgendasDto {
  @ApiPropertyOptional({ description: 'Mês de referência (AAAA-MM)' })
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
    description: 'Participantes (consultores)',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  tecnico?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Status da agenda' })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Status da RNS de implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  statusImplantacao?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Códigos de RNS de implantação',
  })
  @IsOptional()
  @Transform(comoLista)
  @IsArray()
  @IsString({ each: true })
  rns?: string[];
}

export class QueryVisitasPortalDto {
  @ApiPropertyOptional({ description: 'Início do período (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataIni?: string;

  @ApiPropertyOptional({ description: 'Fim do período (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  dataFim?: string;
}

export class QueryDescricaoDto {
  @ApiPropertyOptional({ description: 'Protocolo do lançamento' })
  @IsOptional()
  @IsString()
  protocolo?: string;

  @ApiPropertyOptional({
    description: 'Data e hora do lançamento (AAAA-MM-DD HH:MM)',
  })
  @IsOptional()
  @IsString()
  datahora?: string;
}
