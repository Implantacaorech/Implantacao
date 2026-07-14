import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SalvarChaveIaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() apiKey?: string;
}
