import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Envio do painel "Visitas do Portal Rech" por e-mail, com o PDF anexo.
 *
 * A tela manda o que ela ESTÁ MOSTRANDO (linhas já filtradas + o gráfico como PNG do
 * canvas + a descrição do recorte) — o backend não reexecuta a consulta, então o anexo é a
 * fotografia fiel do que o usuário via ao clicar em enviar. */
export class EnviarVisitasEmailDto {
  @ApiProperty({
    description: 'Destinatário(s) — um ou mais e-mails separados por ; ou ,',
  })
  @IsString()
  @MaxLength(500)
  para: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  assunto: string;

  @ApiProperty({ description: 'Texto do e-mail (pré-preenchido pelo modelo)' })
  @IsString()
  @MaxLength(20000)
  corpo: string;

  @ApiPropertyOptional({
    description: 'PNG do gráfico como data URL (canvas.toDataURL)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4_000_000)
  graficoPng?: string;

  @ApiProperty({
    type: [String],
    description:
      'Linhas descritivas do recorte aplicado (período, visão, filtros)',
  })
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  recorte: string[];

  /** Linhas da tabela como a tela as exibe. Objetos crus de propósito (a sanitização de
   * tipo/campo é do serviço, campo a campo) — o teto de itens protege o payload. */
  @ApiProperty({ description: 'Linhas filtradas da tabela (máx. 5000)' })
  @IsArray()
  @ArrayMaxSize(5000)
  linhas: Record<string, unknown>[];
}
