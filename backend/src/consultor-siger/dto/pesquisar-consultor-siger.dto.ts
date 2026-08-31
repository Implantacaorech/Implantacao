import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { VisaoConsulta } from '../consultor-siger.constants';

/** Pergunta em linguagem natural da tela Execução → Consultor SIGER. */
export class PesquisarConsultorSigerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  q!: string;

  /** `funcional` (padrão) fala a língua da implantação; `tecnica` acrescenta código,
   * programas e campos de tabela na seção "origem técnica". */
  @IsOptional()
  @IsIn(['funcional', 'tecnica'])
  visao?: VisaoConsulta;
}

/** Avaliação do consultor sobre a última resposta (👍/👎 + observação livre). */
export class FeedbackConsultorSigerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  pergunta!: string;

  @IsBoolean()
  util!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
}
