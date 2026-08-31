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
      'Consultas que este token poderá chamar, pelo nome. A lista válida vem de ' +
      'GET /api/dados/v1/admin/clientes/consultas-disponiveis. A autorização é POR ' +
      'CONSULTA: o token não alcança nada além do que estiver aqui.',
    example: ['sicla.rns.listar', 'sicla.rns.detalhar'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  consultas: string[];

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

  @ApiPropertyOptional({
    example: ['sicla.rns.listar', 'portal.visitas.listar'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consultas?: string[];

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
