import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class PingDto {
  /** Identificador da ABA, gerado pelo navegador (sessionStorage). */
  @ApiProperty() @IsString() @Length(1, 64) sessao: string;
  @ApiProperty() @IsString() @MaxLength(300) rota: string;
  @ApiProperty() @IsString() @MaxLength(160) titulo: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() visivel?: boolean;
}

export class SairDto {
  @ApiProperty() @IsString() @Length(1, 64) sessao: string;
}
