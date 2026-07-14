import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Campos confirmados/editados pelo usuário na tela de confirmação do fluxo (após
 * `POST /fluxo/parse` ou `POST /fluxo/inbox`) — mesma forma de CamposFechamento, mas
 * como corpo de requisição explícito (o parse já rodou; aqui só criamos o projeto). */
export class CriarFechamentoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() cliente?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ramo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cidade?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contatoNome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contatoEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contatoTel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contatos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroProjeto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modulos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horasCobradas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horasBonificadas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}
