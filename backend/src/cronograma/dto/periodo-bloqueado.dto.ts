import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PeriodoBloqueadoCriarDto {
  @ApiProperty() @IsString() @IsNotEmpty() dataIni: string;
  @ApiProperty() @IsString() @IsNotEmpty() dataFim: string;
  @ApiPropertyOptional() @IsOptional() @IsString() motivo?: string;

  // Vazio/ausente = vale para todos os técnicos do projeto.
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tecnicos?: string[];
}
