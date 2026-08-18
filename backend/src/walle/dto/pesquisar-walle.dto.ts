import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/** Filtros da busca no acervo Wall-e (§31). Tudo opcional: sem `q` a tela navega pelos
 * documentos mais recentes. */
export class PesquisarWalleDto {
  @ApiPropertyOptional({ description: 'Pergunta/termos em linguagem natural' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @ApiPropertyOptional({ description: 'Restringe a um chat (código da pasta)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chat?: number;

  @ApiPropertyOptional({
    description: 'Categoria do conteúdo (classificação automática)',
  })
  @IsOptional()
  @IsIn([
    'analise',
    'investigacao',
    'causa-raiz',
    'sql',
    'log',
    'planejamento',
    'estatistica',
    'proposta',
    'imagem',
    'outro',
  ])
  categoria?: string;

  @ApiPropertyOptional({ description: 'Produzido pelo Wall-e × insumo recebido' })
  @IsOptional()
  @IsIn(['produzido', 'insumo', 'indeterminado'])
  origem?: string;

  @ApiPropertyOptional({ description: 'Assunto (chip clicável da tela)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  assunto?: string;
}

/** Pergunta em linguagem natural para a síntese por IA (GET — operação de leitura). */
export class PerguntarWalleDto {
  @ApiPropertyOptional({ description: 'Pergunta em linguagem natural' })
  @IsString()
  @MaxLength(500)
  q: string;
}
