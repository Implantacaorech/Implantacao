import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LinhaCronogramaDto } from './linha-cronograma.dto';

export class SalvarCronogramaDto {
  @ApiProperty({ type: [LinhaCronogramaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinhaCronogramaDto)
  linhas: LinhaCronogramaDto[];
}
