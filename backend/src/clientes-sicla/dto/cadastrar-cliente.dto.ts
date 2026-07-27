import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateProjetoDto } from '../../projetos/dto/create-projeto.dto';

/** Cadastro do cliente no passo 1 (Comercial). É a ficha do projeto (CreateProjetoDto) mais
 * o e-mail do próprio Comercial — destinatário do passo 3, quando o levantador repassa o que
 * encontrou. Os campos vêm em parte pré-preenchidos da consulta ao SICLA e em parte
 * completados pelo Comercial. */
export class CadastrarClienteDto extends CreateProjetoDto {
  @ApiPropertyOptional({
    description: 'E-mail do Comercial (recebe o retorno do passo 3).',
  })
  @IsOptional()
  @IsString()
  comercialEmail?: string;
}
