import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SugerirLevantamentoDto {
  /** Gravação de onde as respostas serão sugeridas. Tem de ser uma das que o
   * `GET levantamento/gravacoes` devolveu — a rota confere, não confia na tela. */
  @ApiProperty({ example: 42 })
  @IsInt()
  @Min(1)
  protocoloId: number;
}
