import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class DiaExcluidoDto {
  @IsInt() @Min(0) @Max(4) diaSemana: number;
  @IsIn(['manha', 'tarde']) turno: 'manha' | 'tarde';
}

export class ConfigDistribuicaoDto {
  @ApiPropertyOptional({ enum: ['conjunta', 'individual'] })
  @IsOptional()
  @IsIn(['conjunta', 'individual'])
  modo?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() dataInicio?: string;

  // Lista de (dia da semana, turno) que a distribuição automática NUNCA deve usar — ausente =
  // não mexe na config já salva; [] = passa a considerar todos os dias/turnos.
  @ApiPropertyOptional({ type: [DiaExcluidoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiaExcluidoDto)
  diasExcluidos?: DiaExcluidoDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() analistaPadrao?: string;
}
