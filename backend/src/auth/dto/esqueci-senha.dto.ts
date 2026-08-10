import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class EsqueciSenhaDto {
  @ApiProperty() @IsEmail() email: string;
}
