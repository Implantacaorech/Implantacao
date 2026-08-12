import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { FINALIDADE_IDS, PROVEDORES_IA } from '../ia.constants';
// Tipos usados em propriedades DECORADAS precisam de `import type` com isolatedModules +
// emitDecoratorMetadata (TS1272) — mesmo motivo documentado em outras entities do projeto.
import type { FinalidadeIa, ProvedorIa } from '../ia.constants';

export class SalvarChaveIaDto {
  @ApiProperty({ enum: FINALIDADE_IDS, description: 'Finalidade a configurar' })
  @IsIn(FINALIDADE_IDS)
  finalidade: FinalidadeIa;

  @ApiPropertyOptional({
    enum: PROVEDORES_IA,
    description: 'Provedor da chave (anthropic | openrouter | local)',
  })
  @IsOptional()
  @IsIn(PROVEDORES_IA)
  provider?: ProvedorIa;

  @ApiPropertyOptional({
    description: 'Chave de API. Vazia = remove a configuração da finalidade.',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({
    description:
      'Modelo (ex.: claude-opus-4-8; anthropic/claude-sonnet-4 no OpenRouter; ' +
      'qwen2.5:14b num serviço local)',
  })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({
    description:
      'Só para o provedor `local`: URL base do endpoint compatível com a API da OpenAI, ' +
      'com o caminho da versão (ex.: http://192.168.1.50:11434/v1). Vazia = remove a ' +
      'configuração da finalidade.',
  })
  @IsOptional()
  @IsString()
  baseUrl?: string;
}
