import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReorganizarModuloDto {
  @ApiProperty() @IsString() @IsNotEmpty() modulo: string;
}
