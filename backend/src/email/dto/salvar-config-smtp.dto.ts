import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SalvarConfigSmtpDto {
  @ApiPropertyOptional() @IsOptional() @IsString() host?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() port?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() user?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remetente?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() useTls?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() senha?: string;
}
