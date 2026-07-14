import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class HorarioDto {
  @ApiProperty({ enum: ['manha', 'tarde'] })
  @IsIn(['manha', 'tarde'])
  turno: string;

  @ApiProperty() @IsString() @IsNotEmpty() horaInicio: string;
  @ApiProperty() @IsString() @IsNotEmpty() horaFim: string;
}
