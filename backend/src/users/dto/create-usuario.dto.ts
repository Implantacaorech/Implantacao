import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PERFIS } from '../../common/constants/perfis';
import type { Perfil } from '../../common/constants/perfis';

export class CreateUsuarioDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nome?: string;

  @ApiProperty() @IsEmail() email: string;

  // Em branco usa o e-mail — mesmo comportamento de webapp/app.py:usuarios.
  @ApiPropertyOptional() @IsOptional() @IsString() login?: string;

  @ApiProperty() @IsString() @MinLength(6) senha: string;

  @ApiPropertyOptional({ enum: PERFIS, default: 'Consultor' })
  @IsOptional()
  @IsIn(PERFIS)
  perfil?: Perfil;

  /** TODOS os papéis do usuário — a mesma pessoa acumula cargos (GCI e Levantador, por
   * exemplo). Vazio = vale só o `perfil`. */
  @ApiPropertyOptional({ enum: PERFIS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(PERFIS, { each: true })
  perfis?: Perfil[];

  // Obrigatório em todo perfil INTERNO — elo com a agenda externa (SICLA). Espelha a
  // validação de webapp/app.py:usuarios ("Informe o Código SICLA do usuário — é
  // obrigatório.").
  //
  // Deixou de ser `@IsNotEmpty()` aqui em 2026-08-31 porque o papel `Cliente` não tem
  // código de técnico — exigi-lo obrigaria a inventar um. A obrigatoriedade não sumiu: ela
  // passou para `UsersService.exigirVinculoCoerente`, que sabe quais são os papéis do
  // usuário e cobra o código CERTO de cada lado (técnico p/ interno, cliente p/ `Cliente`).
  @ApiPropertyOptional() @IsOptional() @IsString() codigoSicla?: string;

  /** Código do CLIENTE no SICLA (`LISTA_CLIENTES.CODIGO`) — obrigatório no papel `Cliente`
   * e vazio em todo papel interno. É o recorte de tudo o que esse usuário enxerga no BI
   * (docs/acesso-cliente-bi.md). Aceita mais de um código separado por vírgula. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigoClienteSicla?: string;

  /** Vêm de `SICLA.LISTA_TECNICOS` (MODULOCAPACITADO / SETORDES) na importação de técnicos,
   * mas continuam editáveis à mão pelo Administrador. */
  @ApiPropertyOptional() @IsOptional() @IsString() modulosCapacitados?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() setorAtuacao?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
