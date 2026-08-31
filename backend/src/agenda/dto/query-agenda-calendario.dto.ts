import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Janela do calendário da tela Execução → Agenda. As duas datas são opcionais e passam
 * por saneamento no serviço (`AgendaService.periodo`): ausente/ inválida cai na semana de
 * hoje, invertida é ordenada, larga demais é aparada — por isso aqui basta ser texto. */
export class QueryAgendaCalendarioDto {
  @ApiPropertyOptional({ description: 'Primeiro dia da janela (AAAA-MM-DD)' })
  @IsOptional()
  @IsString()
  ini?: string;

  @ApiPropertyOptional({
    description: 'Último dia da janela, INCLUSIVE (AAAA-MM-DD)',
  })
  @IsOptional()
  @IsString()
  fim?: string;
}
