import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Configuração de uma conexão externa, como o **Portal API** a edita.
 *
 * Os campos são a união dos dois dialetos (Oracle do SICLA e MySQL do Portal Rech) — cada
 * conexão usa os seus e ignora o resto. Todos opcionais de propósito: gravar só `ativo`,
 * ou só a porta, é uso legítimo, e o serviço mescla sobre a configuração vigente.
 *
 * **`senha` em branco MANTÉM a atual.** É o que permite corrigir host/porta sem redigitar o
 * segredo — e é o mesmo contrato das telas antigas do Painel. A senha nunca volta numa
 * resposta; o que volta é `temSenha`. */
export class ConfiguracaoConexaoDto {
  @ApiPropertyOptional({ example: 'oracle' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tipo?: string;

  @ApiPropertyOptional({ example: 'srv-oracle.rech.local' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  host?: string;

  @ApiPropertyOptional({ example: '1521' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  porta?: string;

  @ApiPropertyOptional({ example: 'SICLA' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  banco?: string;

  @ApiPropertyOptional({ example: 'painel_ro' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuario?: string;

  @ApiPropertyOptional({ description: 'Em branco mantém a senha atual.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  senha?: string;

  @ApiPropertyOptional({
    description: 'URL completa; quando presente, prevalece.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional({ description: 'SELECT de ocupação (só SICLA).' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  select?: string;

  @ApiPropertyOptional({
    description: 'SELECT do mapa de técnicos (só SICLA).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  selectTecnicos?: string;

  @ApiPropertyOptional({
    description: 'Pasta do Instant Client (só SICLA/Oracle).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  oracleLibDir?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  oracleThick?: boolean;

  @ApiPropertyOptional({ description: 'Desligar sem apagar a credencial.' })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
