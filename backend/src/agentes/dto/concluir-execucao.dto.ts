import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { STATUS_AGENTE_EXECUCAO } from '../../database/entities/agente-execucao.entity';
import type { StatusAgenteExecucao } from '../../database/entities/agente-execucao.entity';

export class ConcluirExecucaoDto {
  @ApiProperty({ enum: STATUS_AGENTE_EXECUCAO.filter((s) => s !== 'em_execucao') })
  @IsIn(STATUS_AGENTE_EXECUCAO)
  status: StatusAgenteExecucao;

  @ApiPropertyOptional({ description: 'Resumo curto do resultado' })
  @IsOptional()
  @IsString()
  resultado?: string;
}
