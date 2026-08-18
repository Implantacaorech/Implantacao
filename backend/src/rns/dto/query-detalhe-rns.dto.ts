import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/** Número da RNS (o `PEDIDO` de `LISTA_ITEMPED`) cujo resumo completo será buscado —
 * é o `rns` do compromisso clicado no calendário da Agenda. */
export class QueryDetalheRnsDto {
  @ApiProperty({ description: 'Número da RNS (PEDIDO no SICLA)', example: 138643 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numero!: number;
}
