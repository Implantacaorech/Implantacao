import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CHECK_STATUS } from '../../database/entities/checklist-item.entity';
import type { StatusChecklistItem } from '../../database/entities/checklist-item.entity';

export class LinhaChecklistDto {
  @ApiPropertyOptional() @IsOptional() @IsString() modulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() item?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsavel?: string;

  @ApiPropertyOptional({ enum: CHECK_STATUS })
  @IsOptional()
  @IsIn(CHECK_STATUS)
  status?: StatusChecklistItem;

  @ApiPropertyOptional() @IsOptional() @IsString() obs?: string;
}
