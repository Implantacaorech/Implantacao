import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class RevogarContatosDto {
  /** E-mails dos contatos que perdem o acesso. Nunca é "todos" por omissão: revogar em
   * massa sem dizer quem é o tipo de operação que se faz sem querer. */
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  emails: string[];
}
