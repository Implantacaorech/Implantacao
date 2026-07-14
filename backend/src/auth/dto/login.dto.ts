import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ana.consultora' })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({ example: 'senha-forte' })
  @IsString()
  @MinLength(1)
  senha: string;
}
