import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
// `import type`: são tipos usados em assinatura DECORADA, e com isolatedModules +
// emitDecoratorMetadata o TypeScript exige a forma explícita.
import type { PapelProjeto } from '../../database/entities/projeto-pessoa.entity';
import type { TipoRns } from '../../database/entities/projeto-rns.entity';

const PAPEIS: PapelProjeto[] = ['levantador', 'consultor'];
const TIPOS_RNS: TipoRns[] = ['RNI', 'COB', 'Conversão'];

/** E-mail que a pessoa revisou na tela antes de o Painel enviar.
 *
 * Declarado ANTES de quem o usa: com `emitDecoratorMetadata`, o `@Type(() => …)` de
 * `ConcluirPassoDto` é avaliado quando a classe é definida, e a ordem inversa quebra o
 * carregamento do módulo ("Cannot access before initialization"). */
export class EmailRedigidoDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  para?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  assunto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  corpo?: string;
}

export class ConcluirPassoDto {
  /** Texto que a pessoa escreveu ao concluir. No passo 5 é a descrição da negociação, que o
   * e-mail do passo seguinte carrega em `{{DESCRICAO_PASSO}}`. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  observacao?: string;

  /** Marcação que os passos 7 (contrato assinado) e 12 (projeto assinado) exigem. */
  @IsOptional()
  @IsBoolean()
  marcado?: boolean;

  /** Data da assinatura, ISO `aaaa-mm-dd`, que acompanha `marcado`. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dataMarcada?: string;

  /** E-mail revisado na tela, nos passos em que a pessoa redige antes de enviar. Ausente =
   * usa o modelo do passo. */
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailRedigidoDto)
  email?: EmailRedigidoDto;
}

/** Configuração de destinatários de um passo (Sistema → Ferramentas). */
export class DestinatariosPassoDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  grupos?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  extras?: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class DefinirPessoasDto {
  @IsIn(PAPEIS)
  papel: PapelProjeto;

  /** Lista completa do papel — substitui a anterior. Um projeto pode ter mais de um
   * levantador e mais de um consultor. */
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  pessoas: string[];
}

export class RnsDto {
  @IsIn(TIPOS_RNS)
  tipo: TipoRns;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  situacao?: string;
}

export class AtualizarRnsDto {
  @IsOptional()
  @IsIn(TIPOS_RNS)
  tipo?: TipoRns;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  situacao?: string;
}
