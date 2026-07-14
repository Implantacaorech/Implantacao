import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LinhaChecklistDto } from './linha-checklist.dto';

export class SalvarChecklistDto {
  @ApiProperty({ type: [LinhaChecklistDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinhaChecklistDto)
  linhas: LinhaChecklistDto[];
}
