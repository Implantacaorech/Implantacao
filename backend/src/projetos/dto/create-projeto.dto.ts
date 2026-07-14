import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ETAPAS, SITUACOES } from '../../common/constants/perfis';
import type { Etapa, Situacao } from '../../common/constants/perfis';

export class CreateProjetoDto {
  @ApiProperty({ example: 'Cliente Exemplo LTDA' })
  @IsString()
  @IsNotEmpty()
  cliente: string;

  @ApiPropertyOptional() @IsOptional() @IsString() cnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroProjeto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroProposta?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ramo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsavel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() consultor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gci?: string;

  @ApiPropertyOptional({ enum: ETAPAS })
  @IsOptional()
  @IsIn(ETAPAS)
  etapa?: Etapa;

  @ApiPropertyOptional({ enum: SITUACOES })
  @IsOptional()
  @IsIn(SITUACOES)
  situacao?: Situacao;

  @ApiPropertyOptional() @IsOptional() @IsString() dataInicio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dataLevantamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dataUsoOficial?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dataEncerramento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horasCobradas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horasBonificadas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modulos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contatoNome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contatoEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contatoTel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contatos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}
