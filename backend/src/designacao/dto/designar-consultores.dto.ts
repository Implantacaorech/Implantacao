import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class DesignarConsultoresDto {
  // {modulo: consultor} — um select por módulo no Flask original; módulo sem consultor
  // escolhido pode vir ausente/vazio (fica sem designação).
  @ApiProperty({ type: Object, example: { FAT: 'Ana', CTB: 'Beto' } })
  @IsObject()
  designacoes: Record<string, string>;
}
