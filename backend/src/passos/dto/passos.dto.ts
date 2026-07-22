import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
// `import type`: são tipos usados em assinatura DECORADA, e com isolatedModules +
// emitDecoratorMetadata o TypeScript exige a forma explícita.
import type { PapelProjeto } from '../../database/entities/projeto-pessoa.entity';
import type { TipoRns } from '../../database/entities/projeto-rns.entity';

const PAPEIS: PapelProjeto[] = ['levantador', 'consultor'];
const TIPOS_RNS: TipoRns[] = ['RNI', 'COB', 'Conversão'];

export class ConcluirPassoDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
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
