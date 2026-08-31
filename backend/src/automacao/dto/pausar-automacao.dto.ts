import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PausarAutomacaoDto {
  /** Por que a automação está sendo pausada — vai no erro que a IA/robôs devolvem e na tela. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
