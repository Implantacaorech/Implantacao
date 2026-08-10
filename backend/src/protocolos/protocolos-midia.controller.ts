import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { resolve, sep } from 'path';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { ProtocolosService } from './protocolos.service';
import { tipoMime } from './protocolos.constants';

/** Conteúdo do ticket de mídia (ver ProtocolosController.videoTicket). */
export interface TicketMidia {
  /** Id do protocolo que o ticket libera — e só ele. */
  pid: number;
  escopo: 'midia';
}

/** Streaming do vídeo/áudio original, em controller PRÓPRIO e sem os guards de classe.
 *
 * Por que separado: o `<video>`/`<audio>` do navegador busca a mídia sozinho, e não há como
 * mandar cabeçalho `Authorization` nessa requisição. A tela contornava isso baixando o
 * arquivo INTEIRO por HttpClient e criando um blob — com um vídeo de reunião de 56 min
 * (183 MB) isso significa esperar o download inteiro antes de o player mostrar qualquer
 * coisa, segurar tudo na memória do navegador e ainda perder o "arrastar a barra".
 *
 * Aqui a mídia volta a ser servida como mídia: `Range` de verdade, o player começa na hora e
 * busca só o pedaço que precisa. No lugar do cabeçalho, um TICKET assinado e curto
 * (`?t=`), emitido pela rota autenticada `GET /protocolos/:id/video-ticket` e válido só para
 * aquele protocolo — o token de sessão nunca vai para a URL (URL entra em log de servidor,
 * histórico do navegador e "copiar link"). */
@ApiTags('protocolos')
@Controller('protocolos')
export class ProtocolosMidiaController {
  constructor(
    private readonly protocolos: ProtocolosService,
    private readonly processamento: ProcessamentoProtocolosService,
    private readonly jwt: JwtService,
  ) {}

  @Get(':id/video')
  @ApiExcludeEndpoint()
  async video(
    @Param('id', ParseIntPipe) id: number,
    @Query('t') ticket: string | undefined,
    @Res() res: Response,
  ) {
    this.exigirTicket(ticket, id);

    const p = await this.protocolos.buscar(id);
    if (!p) throw new NotFoundException('Protocolo não encontrado.');
    const caminho = resolve(p.videoCaminho || '');
    const raiz = resolve(this.processamento.pastaRaiz());
    if (
      !existsSync(caminho) ||
      !(caminho === raiz || caminho.startsWith(raiz + sep))
    ) {
      throw new ForbiddenException('Arquivo fora da pasta permitida.');
    }

    const tamanho = statSync(caminho).size;
    res.set({
      'Content-Type': tipoMime(p.videoNome || caminho),
      'Accept-Ranges': 'bytes',
      // A mídia é imutável (o arquivo não muda depois de registrado) e o ticket já limita
      // o acesso no tempo — cache privado evita rebaixar o mesmo trecho a cada seek.
      'Cache-Control': 'private, max-age=3600',
    });

    const range = res.req.headers.range;
    if (!range) {
      res.set({ 'Content-Length': String(tamanho) });
      createReadStream(caminho).pipe(res);
      return;
    }
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) throw new BadRequestException('Cabeçalho Range inválido.');
    const inicio = match[1] ? parseInt(match[1], 10) : 0;
    const fim = match[2] ? parseInt(match[2], 10) : tamanho - 1;
    if (inicio >= tamanho || fim >= tamanho || inicio > fim) {
      // Sem isto, um seek além do fim faria o Node estourar no createReadStream e o player
      // simplesmente parava, sem explicação.
      res
        .status(416)
        .set({ 'Content-Range': `bytes */${tamanho}` })
        .end();
      return;
    }
    res.status(206);
    res.set({
      'Content-Range': `bytes ${inicio}-${fim}/${tamanho}`,
      'Content-Length': String(fim - inicio + 1),
    });
    createReadStream(caminho, { start: inicio, end: fim }).pipe(res);
  }

  private exigirTicket(ticket: string | undefined, id: number): void {
    if (!ticket) {
      throw new UnauthorizedException('Ticket de mídia ausente.');
    }
    let dados: TicketMidia;
    try {
      dados = this.jwt.verify<TicketMidia>(ticket);
    } catch {
      throw new UnauthorizedException(
        'Ticket de mídia inválido ou expirado — recarregue a página.',
      );
    }
    // Um ticket vale para UM protocolo: sem esta checagem, quem obtivesse o ticket do
    // próprio vídeo assistiria ao de qualquer outro trocando o id na URL.
    if (dados.escopo !== 'midia' || Number(dados.pid) !== id) {
      throw new ForbiddenException('Ticket de mídia não vale para este item.');
    }
  }
}
