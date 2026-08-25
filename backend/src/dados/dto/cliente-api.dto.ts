import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Cadastro de um cliente de MÁQUINA da API de Dados (Sistema → API de Dados, ADM). */
export class CriarClienteApiDto {
  @ApiProperty({ example: 'Power BI — Diretoria' })
  @IsString()
  @MaxLength(160)
  nome: string;

  @ApiProperty({
    description:
      'Escopos permitidos. A lista válida vem de GET /api/dados/v1/clientes/escopos.',
    example: ['sicla:leitura'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  escopos: string[];

  @ApiPropertyOptional({
    description: 'Para que serve / quem é o responsável.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacao?: string;
}

export class AtualizarClienteApiDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nome?: string;

  @ApiPropertyOptional({ example: ['sicla:leitura', 'portal_rech:leitura'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  escopos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacao?: string;
}

export class DefinirAtivoDto {
  @ApiProperty({ description: 'false revoga o acesso sem apagar o registro.' })
  @IsBoolean()
  ativo: boolean;
}
