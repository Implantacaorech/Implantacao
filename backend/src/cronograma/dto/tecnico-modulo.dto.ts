import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class TecnicoModuloDto {
  @ApiProperty() @IsString() @IsNotEmpty() modulo: string;

  // undefined = não mexe no técnico já designado nos cartões (ex.: só ordem/analista mudam).
  @ApiPropertyOptional() @IsOptional() @IsString() tecnico?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() ordem?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() naoDistribuir?: boolean;

  // "" limpa a sobreposição e volta a usar o analista padrão do projeto.
  @ApiPropertyOptional() @IsOptional() @IsString() analista?: string;
}
