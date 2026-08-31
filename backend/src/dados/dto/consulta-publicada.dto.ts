import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const CONEXOES = ['sicla', 'portal_rech'] as const;
const TIPOS = [
  'data',
  'competencia',
  'datahora_minuto',
  'inteiro',
  'texto',
  'texto_busca',
  'lista_texto',
] as const;

/** Um parâmetro do contrato. O NOME não é digitado: vem do `Testar`, que extrai os binds do
 * próprio SQL. O que o operador escolhe é o tipo e a obrigatoriedade. */
export class ParametroDto {
  @ApiProperty({ example: 'data_ini' })
  @IsString()
  @MaxLength(60)
  nome: string;

  @ApiProperty({ enum: TIPOS })
  @IsIn(TIPOS)
  tipo: (typeof TIPOS)[number];

  @ApiProperty()
  @IsBoolean()
  obrigatorio: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descricao?: string;

  @ApiPropertyOptional({
    description: 'Teto de caracteres, para os tipos de texto.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxTamanho?: number;
}

/** "Testar": roda o SELECT com limite 1 para descobrir binds e colunas. */
export class AnalisarConsultaDto {
  @ApiProperty({ enum: CONEXOES })
  @IsIn(CONEXOES)
  conexao: (typeof CONEXOES)[number];

  @ApiProperty()
  @IsString()
  sql: string;

  @ApiPropertyOptional({
    description: 'Valor de exemplo por bind, só para o teste rodar.',
    example: { data_ini: '2026-08-01', data_fim: '2026-08-31' },
  })
  @IsOptional()
  @IsObject()
  exemplos?: Record<string, unknown>;
}

/** Cria ou atualiza uma consulta da tela. `publicada: true` a coloca no catálogo da API — e
 * só então as validações de contrato (nome, bind × parâmetro, teto) são exigidas. */
export class SalvarConsultaPublicadaDto {
  @ApiProperty({
    description: 'Identificador interno (slug).',
    example: 'rns_por_cliente',
  })
  @IsString()
  @MaxLength(60)
  slug: string;

  @ApiProperty({ description: 'Rótulo legível.', example: 'RNS por cliente' })
  @IsString()
  @MaxLength(160)
  nome: string;

  @ApiProperty({ enum: CONEXOES })
  @IsIn(CONEXOES)
  conexao: (typeof CONEXOES)[number];

  @ApiProperty()
  @IsString()
  sql: string;

  @ApiProperty({
    description: 'Nome público no catálogo: <origem>.<assunto>.<ação>.',
    example: 'sicla.rns.por-cliente',
  })
  @IsString()
  @MaxLength(80)
  nomeApi: string;

  @ApiProperty({ type: [ParametroDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParametroDto)
  parametros: ParametroDto[];

  @ApiProperty({
    description: 'Colunas de retorno, vindas do Testar.',
    example: ['PEDIDO'],
  })
  @IsArray()
  @IsString({ each: true })
  colunas: string[];

  @ApiProperty({ description: 'Teto de linhas trazidas do banco.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limiteLinhas: number;

  @ApiProperty({ description: 'Segundos de cache (0 = sem cache).' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cacheSegundos: number;

  @ApiProperty({ description: 'true a publica no catálogo da API.' })
  @IsBoolean()
  publicada: boolean;
}
