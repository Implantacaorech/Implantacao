import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Cadastro de um token do Portal API. `consultas` não é digitada pela pessoa: a tela a
 * preenche com o que o **Testar** descobriu — o catálogo que o Portal API devolve para
 * aquele token já vem recortado pelo que ele autoriza. */
export class SalvarTokenApiDto {
  @ApiProperty({ example: 'Portal API — rede interna' })
  @IsString()
  @MaxLength(160)
  nome: string;

  @ApiProperty({ example: 'http://I7M1700-01-EVE:5110' })
  @IsString()
  @MaxLength(300)
  url: string;

  @ApiPropertyOptional({
    description:
      'Em branco na edição MANTÉM o token atual (ele nunca volta para a tela).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  chave?: string;

  @ApiProperty({ type: [String], example: ['sicla.rns.listar'] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  consultas: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

/** "Testar": pergunta ao Portal API o que este token alcança, antes de gravar. */
export class SondarTokenApiDto {
  @ApiProperty({ example: 'http://I7M1700-01-EVE:5110' })
  @IsString()
  @MaxLength(300)
  url: string;

  @ApiProperty({ example: 'rd_ab12cd34ef56_...' })
  @IsString()
  @MaxLength(400)
  chave: string;
}

export class DefinirAtivoTokenDto {
  @ApiProperty()
  @IsBoolean()
  ativo: boolean;
}
