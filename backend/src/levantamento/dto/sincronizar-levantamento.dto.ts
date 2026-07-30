import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional } from 'class-validator';

/** Tique da tela colaborativa: diz onde este técnico está (presença) e pede só o que mudou
 * desde a última sincronização. Um único endpoint para os dois assuntos porque a tela chama
 * os dois no mesmo intervalo — dobrar requisição por segundo não traria nada. */
export class SincronizarLevantamentoDto {
  @ApiPropertyOptional({
    description:
      'Linha em que o técnico está com o cursor agora (null = nenhuma).',
  })
  @IsOptional()
  @IsInt()
  linhaId?: number | null;

  @ApiPropertyOptional({
    description:
      'Instante da última sincronização (ISO). Sem ele, devolve todas as linhas.',
  })
  @IsOptional()
  @IsISO8601()
  desde?: string;
}
