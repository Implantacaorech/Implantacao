import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  MaxLength,
} from 'class-validator';

/** Todos os DTOs do módulo num arquivo só: são pequenos, mudam juntos e ler o contrato
 * inteiro de uma vez ajuda mais do que quinze arquivos de cinco linhas. */

export class AbrirQuadroDto {
  @ApiProperty() @IsString() @Length(1, 40) codigoClienteSicla: string;
  @ApiProperty() @IsString() @MaxLength(200) nomeCliente: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) projetoId?: number;
}

export class ResponsavelDto {
  @ApiProperty() @IsInt() @Min(1) usuarioId: number;
}

export class CriarListaDto {
  @ApiProperty() @IsString() @Length(1, 80) titulo: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() visivelCliente?: boolean;
}

export class EditarListaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  titulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() visivelCliente?: boolean;
}

export class CriarCartaoDto {
  @ApiProperty() @IsInt() @Min(1) listaId: number;
  @ApiProperty() @IsString() @Length(1, 200) titulo: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descricao?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  prazo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  etiquetas?: string[];
  /** Só o CLIENTE usa: o consultor a quem a solicitação é designada. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  designadoUsuarioId?: number;
}

export class EditarCartaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  titulo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descricao?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  prazo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  etiquetas?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) projetoId?: number;
}

export class MoverCartaoDto {
  @ApiProperty() @IsInt() @Min(1) listaId: number;
  /** Posição na coluna de destino (0 = topo). */
  @ApiProperty() @IsInt() @Min(0) indice: number;
}

export class VisibilidadeDto {
  @ApiProperty() @IsBoolean() visivelCliente: boolean;
}

export class MembroDto {
  @ApiProperty() @IsIn(['interno', 'cliente']) tipo: 'interno' | 'cliente';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) usuarioId?: number;
  @ApiProperty() @IsString() @Length(1, 160) nome: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargo?: string;
}

export class ItemChecklistDto {
  @ApiProperty() @IsString() @Length(1, 300) texto: string;
}

export class MarcarItemDto {
  @ApiProperty() @IsBoolean() feito: boolean;
}

export class ComentarioDto {
  @ApiProperty() @IsString() @Length(1, 4000) texto: string;
}

export class LinkDto {
  @ApiProperty() @IsString() @MaxLength(2000) url: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(260)
  nome?: string;
}

export class MarcarLidasDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  ids?: number[];
}
