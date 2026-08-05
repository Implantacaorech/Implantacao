import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** De onde veio o áudio da reunião — muda só o texto do histórico, mas é o que distingue
 * uma reunião presencial (microfone da sala) de uma remota pelo Teams (áudio da tela
 * compartilhada) quando alguém for auditar a gravação depois. */
export const FONTES_AUDIO = ['microfone', 'reuniao', 'ambos'] as const;
export type FonteAudio = (typeof FONTES_AUDIO)[number];

export const ROTULO_FONTE: Record<FonteAudio, string> = {
  microfone: 'microfone (reunião presencial)',
  reuniao: 'áudio da reunião remota (Teams/tela)',
  ambos: 'microfone + áudio da reunião remota (Teams/tela)',
};

export class IniciarGravacaoDto {
  /** Projeto do painel, quando a gravação foi aberta de dentro dele (botão do
   * Levantamento). Nos demais casos o cliente vem da busca no SICLA, abaixo. */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projetoId?: number;

  /** Código do cliente no SICLA (resultado de `GET /protocolos/clientes?termo=`). */
  @ApiPropertyOptional() @IsOptional() @IsString() clienteCodigo?: string;

  /** Nome do cliente escolhido na busca. Sem ele (e sem projetoId) a gravação fica sem
   * dono — conteúdo genérico, que é uma opção válida. */
  @ApiPropertyOptional() @IsOptional() @IsString() cliente?: string;

  /** CNPJ vindo do SICLA — usado só para tentar amarrar um projeto já existente. */
  @ApiPropertyOptional() @IsOptional() @IsString() cnpj?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() titulo?: string;

  /** Nomes dos participantes e termos da reunião, separados por vírgula. Vira `hotwords`
   * do Whisper — ver Protocolo.vocabulario. */
  @ApiPropertyOptional() @IsOptional() @IsString() vocabulario?: string;

  /** Quantas pessoas vão falar. >= 2 liga a separação de locutores; 1 desliga.
   *
   * OBRIGATÓRIO (decisão do usuário em 2026-08-04): a tela não oferece mais um valor
   * inicial. Um default aqui decidiria calado por "não separar" — e a separação só pode
   * ser feita DURANTE a gravação, então quem descobrisse depois teria de refazer a
   * reunião. Ver Protocolo.participantes. */
  @Type(() => Number)
  @IsInt({ message: 'Informe quantas pessoas vão falar na reunião.' })
  @Min(1, { message: 'Informe quantas pessoas vão falar na reunião.' })
  @Max(12)
  participantes: number;

  @ApiPropertyOptional({ enum: FONTES_AUDIO })
  @IsOptional()
  @IsIn(FONTES_AUDIO)
  fonte?: FonteAudio;
}

/** O áudio em si vai como arquivo (multipart) — aqui só o número de ordem do trecho. */
export class TrechoGravacaoDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seq: number;
}

/** Renomear os locutores da transcrição: `{ "P1": "Ivian", "P2": "Marcos" }`. */
export class MapaLocutoresDto {
  @IsObject()
  mapa: Record<string, string>;
}

export class FinalizarGravacaoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() titulo?: string;

  /** Descarta a transcrição feita ao vivo e manda transcrever o .wav inteiro pelo
   * pipeline normal — mais lento (roda o Whisper de novo sobre a reunião toda), porém sem
   * os cortes entre trechos. Ligado automaticamente quando a transcrição ao vivo voltou
   * vazia. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  @IsBoolean()
  retranscrever?: boolean;
}
