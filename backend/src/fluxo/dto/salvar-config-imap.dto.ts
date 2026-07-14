import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SalvarConfigImapDto {
  @ApiPropertyOptional() @IsOptional() @IsString() host?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() port?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() user?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pasta?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() senha?: string;
}
