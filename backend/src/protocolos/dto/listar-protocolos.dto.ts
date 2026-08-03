import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListarProtocolosDto {
  @ApiPropertyOptional() @IsOptional() @IsString() modulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() menu?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() origem?: string;
  /** Nome (ou parte) do cliente a que o protocolo foi direcionado. */
  @ApiPropertyOptional() @IsOptional() @IsString() cliente?: string;
}
