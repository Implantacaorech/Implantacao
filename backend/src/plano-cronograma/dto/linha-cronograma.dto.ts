import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CRONO_STATUS } from '../../database/entities/cronograma-item.entity';
import type { StatusCronogramaItem } from '../../database/entities/cronograma-item.entity';

export class LinhaCronogramaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() etapa?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() topicos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() data?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modalidade?: string;

  @ApiPropertyOptional({ enum: CRONO_STATUS })
  @IsOptional()
  @IsIn(CRONO_STATUS)
  status?: StatusCronogramaItem;
}
