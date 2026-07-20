import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PerguntarDicionarioDto {
  @ApiProperty({ description: 'Pergunta em linguagem natural sobre o SIGER®' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  pergunta: string;
}
