import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class IniciarExecucaoDto {
  @ApiProperty({ example: 'painel-core', description: 'Nome do agente (ver .claude/agents/)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  agente: string;

  @ApiPropertyOptional({ example: 'Ajustar gate da etapa Designação' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tarefa?: string;

  @ApiPropertyOptional({ description: 'Id da execução do agente que acionou este (hierarquia)' })
  @IsOptional()
  @IsInt()
  agentePaiId?: number;
}
