import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class AlocarAtividadeDto {
  // "" desaloca; ausente = não mexe na data.
  @ApiPropertyOptional() @IsOptional() @IsString() data?: string;

  @ApiPropertyOptional({ enum: ['manha', 'tarde', ''] })
  @IsOptional()
  @IsIn(['manha', 'tarde', ''])
  turno?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() tecnico?: string;
}
