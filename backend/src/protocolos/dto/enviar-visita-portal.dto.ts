import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Campos do atendimento conferidos pelo consultor na tela, para criar a visita (rascunho)
 * no Portal Rech. O código do cliente NÃO vem daqui: é lido do protocolo no backend (a tela
 * não escolhe empresa de outro cliente). As datas vêm no formato do `datetime-local`. */
export class EnviarVisitaPortalDto {
  /** Código do cliente no SICLA usado para localizar a empresa no Portal. Opcional: quando
   * vazio, o backend usa o código gravado no próprio protocolo. Editável na tela para
   * resgatar o caso do protocolo sem código (ou com código a corrigir). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  clienteCodigo?: string;

  @ApiProperty() @IsString() dataInicioVisita: string;
  @ApiProperty() @IsString() dataFimVisita: string;
  @ApiProperty() @IsString() dataInicioDeslocamento: string;
  @ApiProperty() @IsString() dataFimDeslocamento: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  custoPedagio?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  custoEstadia?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  custoAlimentacao?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  custoEstacionamento?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) kmInicial?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) kmFinal?: number;

  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  descricaoAtividade: string;

  /** Nome do módulo escolhido na tela — casa com a descrição do módulo no Portal. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  modulo?: string;

  /** Nome do contato do atendimento — casa com um contato da empresa no Portal. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contatoNome?: string;
}
