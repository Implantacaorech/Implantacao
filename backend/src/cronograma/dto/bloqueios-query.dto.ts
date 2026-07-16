import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BloqueiosQueryDto {
  @ApiProperty({ example: '2026-07-13' }) @IsNotEmpty() @IsString() inicio: string;
  @ApiProperty({ example: '2026-07-17' }) @IsNotEmpty() @IsString() fim: string;
}
