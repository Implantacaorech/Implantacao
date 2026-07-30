import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ImportarTecnicosDto {
  /** Códigos SICLA a importar. Vazio/ausente = importa a lista inteira. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codigos?: string[];
}
