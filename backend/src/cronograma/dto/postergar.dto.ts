import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Posterga por assunto (atividadeId) OU por turno inteiro (data+turno) — um dos dois. */
export class PostergarDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() atividadeId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() data?: string;
  @ApiPropertyOptional({ enum: ['manha', 'tarde'] })
  @IsOptional()
  @IsIn(['manha', 'tarde'])
  turno?: string;

  @ApiProperty() @IsString() @IsNotEmpty() novaData: string;
  @ApiProperty({ enum: ['manha', 'tarde'] })
  @IsIn(['manha', 'tarde'])
  novoTurno: string;
}

export class PostergarVisitaDto {
  @ApiProperty() @IsString() @IsNotEmpty() modulo: string;
  @ApiProperty() @IsInt() seq: number;
  @ApiProperty() @IsString() @IsNotEmpty() novaData: string;
  @ApiProperty({ enum: ['manha', 'tarde'] })
  @IsIn(['manha', 'tarde'])
  novoTurno: string;
}
