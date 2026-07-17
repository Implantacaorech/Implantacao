import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListarProjetosDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  // Tela Carteira (projetos-lista.component.ts) busca tudo de uma vez com limit=1000 —
  // faz o agrupamento Kanban/filtro no próprio navegador, sem paginação server-side de
  // verdade (mesmo espírito do Flask original, que não paginava essa listagem). Achado
  // real: @Max(100) rejeitava esse pedido inteiro (400), deixando a Carteira sempre vazia.
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Filtra por cliente (contém, case-insensitive)',
  })
  @IsOptional()
  @IsString()
  cliente?: string;

  @ApiPropertyOptional({ description: 'Filtra por etapa exata' })
  @IsOptional()
  @IsString()
  etapa?: string;
}
