import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ParseFechamentoDto {
  @ApiProperty() @IsString() texto: string;
}
