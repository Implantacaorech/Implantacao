import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateProjetoDto } from '../../projetos/dto/create-projeto.dto';

/** Um módulo contratado marcado na consulta ao SICLA. `codigo` é o EFETIVO (do adicional
 * quando há, senão do módulo); `descricao` é o rótulo para exibir; `obs` é a observação que
 * o Comercial escreveu ao lado do item. */
export class ModuloContratadoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  obs?: string;
}

/** Uma conversão de dados estimada no passo 1: o nome (item fixo ou digitado), a estimativa
 * de horas de conversão e a observação que o Comercial escreveu ao lado do item (mesmo
 * formato da observação dos módulos contratados). */
export class ConversaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  horas?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  obs?: string;
}

/** Cadastro do cliente no passo 1 (Comercial). É a ficha do projeto (CreateProjetoDto) mais
 * o e-mail do próprio Comercial e a lista de módulos contratados marcados no SICLA. */
export class CadastrarClienteDto extends CreateProjetoDto {
  @ApiPropertyOptional({
    description: 'E-mail do Comercial (recebe o retorno do passo 3).',
  })
  @IsOptional()
  @IsString()
  comercialEmail?: string;

  @ApiPropertyOptional({
    type: [ModuloContratadoDto],
    description:
      'Módulos contratados marcados no SICLA (com observação por item). Quando presente, ' +
      'define `modulos` (lista de códigos efetivos) e `modulos_detalhe`.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuloContratadoDto)
  modulosSelecionados?: ModuloContratadoDto[];

  @ApiPropertyOptional({
    type: [ConversaoDto],
    description:
      'Conversões de dados estimadas (com horas por item). Quando presente, define ' +
      '`conversoes` (JSON).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversaoDto)
  conversoesSelecionadas?: ConversaoDto[];
}
