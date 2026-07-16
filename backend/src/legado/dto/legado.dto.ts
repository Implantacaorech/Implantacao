import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Formulários do wizard legado chegam como um dict livre (chave -> string | string[]) —
// mesma forma do flask.request.form (campos simples + campos repetidos das linhas
// dinâmicas de criar_templates.html). Validação fica em legado_cli.py (reusa runner.py).
export type FormLegado = Record<string, string | string[]>;

export class ClienteYamlDto {
  @ApiPropertyOptional({ type: Object }) @IsOptional() form?: FormLegado;
}

export class CriarTemplatesDto {
  @ApiPropertyOptional({ type: Object }) @IsOptional() form?: FormLegado;
}

export class ConverterVerbalTextoDto {
  @IsString() @IsNotEmpty() texto: string;
}

export class FormModulosDto {
  @IsIn(['levantamento', 'checklist']) tipo: 'levantamento' | 'checklist';
  @ApiPropertyOptional({ type: Object }) @IsOptional() form?: FormLegado;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) modulos?: string[];
}

export class GerarDto {
  @IsString() @IsNotEmpty() mod: string;
  // Basename de um YAML de cliente já salvo (de uma chamada anterior a POST /legado/cliente)
  // — usado quando esta requisição não envia um arquivo .yaml próprio.
  @ApiPropertyOptional() @IsOptional() @IsString() clienteArquivo?: string;
}
