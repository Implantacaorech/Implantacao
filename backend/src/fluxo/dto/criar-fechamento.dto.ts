import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

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
  @ApiPropertyOptional() @IsOptional() @IsString() numeroProposta?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() modulos?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horasCobradas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horasBonificadas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dataLevantamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dataUsoOficial?: string;

  // Responsáveis internos (tela de confirmação) — ver comentário em
  // webapp/routes_fluxo.py:fluxo_criar sobre "consultor" guardar o nome do GCI.
  @ApiPropertyOptional() @IsOptional() @IsString() consultor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tecnicos?: string;

  // Orquestração do pacote inicial — não são campos do Projeto.
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gerar?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() emailsResponsaveis?: string;
}
