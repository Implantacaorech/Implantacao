import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class PesquisarDicionarioDto {
  @ApiPropertyOptional({
    description: 'Termo pesquisado (título, resumo, conteúdo, palavras-chave)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtra por tipo de documento',
    enum: ['modulo', 'adicional'],
  })
  @IsOptional()
  @IsIn(['modulo', 'adicional'])
  tipo?: 'modulo' | 'adicional';

  @ApiPropertyOptional({
    description: 'Filtra pela sigla do módulo/adicional (ex.: CTB)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sigla?: string;
}
