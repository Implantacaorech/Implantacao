import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Um campo por chave de PROTO_CAMPOS_TEXTO (protocolos.constants.ts) — todos opcionais,
 * só os enviados são sobrescritos (ver ProtocolosService.salvarEdicao). */
export class SalvarEdicaoProtocoloDto {
  @ApiPropertyOptional() @IsOptional() @IsString() titulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() menu?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assunto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resumo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objetivo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() quandoUtilizar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preRequisitos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() menusAbordados?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() funcionalidades?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() passoAPasso?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() processos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() definicoes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() regrasNegocio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() configuracoes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dependencias?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pontosAtencao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() exemplos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() duvidas?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pendenciasTreinamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() proximosPassos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resumoTecnico?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assuntosRemovidos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pendencias?: string;
}
