import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ReenviarCadastroDto {
  @ApiProperty() @IsEmail() email: string;
}
