import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AdicionarNotaDto {
  @ApiProperty() @IsString() @MinLength(1) nota: string;
}
