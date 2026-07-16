import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TrocarSenhaDto {
  @ApiProperty() @IsString() senhaAtual: string;
  @ApiProperty() @IsString() @MinLength(8) senhaNova: string;
}
