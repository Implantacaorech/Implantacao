import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class SalvarConsultaBdDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sql?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() ordem?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() colunaData?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colunaSituacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mostrarGrafico?: boolean;

  @ApiPropertyOptional({
    description:
      "Conexão onde a consulta roda: 'sicla' (Oracle da Disponibilidade) ou 'portal' (banco do Portal Rech)",
    enum: ['sicla', 'portal'],
  })
  @IsOptional()
  @IsIn(['sicla', 'portal'])
  conexao?: string;
}
