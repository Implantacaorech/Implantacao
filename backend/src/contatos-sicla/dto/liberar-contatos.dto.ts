import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class LiberarContatosDto {
  /** Código do cliente no SICLA. Obrigatório: liberar acesso é sempre DENTRO de um cliente —
   * é ele que vira o recorte do BI de quem recebe a conta. */
  @ApiProperty()
  @IsString()
  cliente: string;

  /** E-mails dos contatos a liberar. Vazio/ausente = todos os contatos liberados daquele
   * cliente. O e-mail é a identidade do contato: `LISTA_CONTATOS` não tem código. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  emails?: string[];
}
