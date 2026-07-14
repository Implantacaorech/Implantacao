import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AlocarVisitaDto {
  @ApiProperty() @IsString() @IsNotEmpty() modulo: string;

  @ApiProperty() @IsInt() seq: number;

  // Ambos vazios/ausentes = desaloca a visita inteira (volta para a lista de pendentes).
  @ApiPropertyOptional() @IsOptional() @IsString() data?: string;

  @ApiPropertyOptional({ enum: ['manha', 'tarde', ''] })
  @IsOptional()
  @IsIn(['manha', 'tarde', ''])
  turno?: string;
}
