import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BloqueiosQueryDto {
  @ApiProperty({ example: '2026-07-13' })
  @IsNotEmpty()
  @IsString()
  inicio: string;
  @ApiProperty({ example: '2026-07-17' }) @IsNotEmpty() @IsString() fim: string;
  @ApiPropertyOptional({
    description:
      'Nome do técnico para visão "individual" (só a agenda dele) — omitido = modo "conjunta" (todos os envolvidos)',
  })
  @IsOptional()
  @IsString()
  tecnico?: string;
}
