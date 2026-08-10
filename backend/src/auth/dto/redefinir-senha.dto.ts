import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @Length(6, 6) codigo: string;
  /** Mesmo mínimo de `TrocarSenhaDto` — o caminho de recuperação não pode ser a porta de
   * entrada para uma senha mais fraca do que a troca normal aceita. */
  @ApiProperty() @IsString() @MinLength(8) senhaNova: string;
}
