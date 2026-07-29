import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Gravação de UMA pergunta do Levantamento — é por aqui que a tela colaborativa salva
 * (autosave por campo). O PUT em lote continua existindo, mas escrever campo a campo é o
 * que permite dois técnicos na mesma tela sem um derrubar o trabalho do outro. */
export class SalvarLinhaLevantamentoDto {
  @ApiPropertyOptional({ description: 'Texto digitado pelo técnico.' })
  @IsOptional()
  @IsString()
  resposta?: string;

  @ApiPropertyOptional({
    description:
      'Marca "Não será utilizado." — o backend grava a frase padrão e ignora `resposta`.',
  })
  @IsOptional()
  @IsBoolean()
  naoUtilizado?: boolean;

  @ApiPropertyOptional({
    description:
      'Versão que o cliente tinha em tela. Divergiu da versão no banco = alguém salvou antes; responde 409 em vez de sobrescrever.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  versao?: number;
}
