import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class ConfirmarCadastroDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @Length(6, 6) codigo: string;
}
