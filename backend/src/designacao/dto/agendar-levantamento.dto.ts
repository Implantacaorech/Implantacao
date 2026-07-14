import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AgendarLevantamentoDto {
  @ApiProperty({ example: '2026-08-10' })
  @IsString()
  dataLevantamento: string;
}
