import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
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

  // Obrigatório em todo perfil — elo com a agenda externa (SICLA). Espelha a validação
  // de webapp/app.py:usuarios ("Informe o Código SICLA do usuário — é obrigatório.").
  @ApiProperty() @IsString() @IsNotEmpty() codigoSicla: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
