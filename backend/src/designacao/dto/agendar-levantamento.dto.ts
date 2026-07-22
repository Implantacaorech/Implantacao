import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class AgendarLevantamentoDto {
  @ApiProperty({ example: '2026-08-10' })
  @IsString()
  dataLevantamento: string;

  /** Pode haver MAIS DE UM levantador, mas a data da visita é a mesma para todos —
   * por isso a data é do projeto e a lista é à parte (revisão do processo, passo 2). */
  @ApiPropertyOptional({ example: ['Ana Consultora', 'Beto Consultor'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  levantadores?: string[];
}
