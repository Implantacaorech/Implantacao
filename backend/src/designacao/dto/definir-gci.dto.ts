import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DefinirGciDto {
  // Suporta mais de 1 GCI (checkboxes no Flask original) — comma-joined ao persistir.
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  gcis: string[];
}
