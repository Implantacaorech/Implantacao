import { IsNotEmpty, IsString } from 'class-validator';

export class EnviarEmailProjetoDto {
  @IsString() @IsNotEmpty() destino: string;
  @IsString() @IsNotEmpty() assunto: string;
  @IsString() corpo: string;
}
