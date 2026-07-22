import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Post,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { GmailService } from './gmail.service';

/** Config → Gmail API (bypass de SMTP bloqueado) — exclusivo do Administrador. Espelha
 * webapp/routes_config.py:config_gmail, com uma diferença deliberada de arquitetura: o
 * Flask original usa o fluxo OAuth "Desktop app" (abre navegador + servidor local
 * efêmero NA MÁQUINA do painel); aqui é "Web application" com uma rota de callback real
 * — ver comentário em cima de GmailService. `GET /config/gmail/callback` é
 * INTENCIONALMENTE pública (sem JwtAuthGuard): é o navegador do Google navegando direto
 * até ela após o consentimento, sem cabeçalho Authorization — a proteção é o `state`
 * de uso único conferido em GmailService.trocarCodigoPorToken. */
@ApiTags('config-gmail')
@Controller('config/gmail')
export class ConfigGmailController {
  constructor(private readonly gmail: GmailService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PERFIS_SISTEMA)
  @ApiOperation({ summary: 'Status da autorização Gmail API' })
  status() {
    return new ApiEnvelope({
      temCliente: this.gmail.temCliente(),
      autorizado: this.gmail.configurado(),
    });
  }

  @Post('client')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PERFIS_SISTEMA)
  @UseInterceptors(FileInterceptor('client'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Envia a credencial OAuth (JSON "Aplicativo da Web") baixada do Google Cloud Console',
  })
  enviarCliente(@UploadedFile() arquivo: Express.Multer.File | undefined) {
    if (!arquivo)
      throw new UnprocessableEntityException(
        'Selecione o arquivo JSON da credencial.',
      );
    this.gmail.salvarCliente(arquivo.buffer);
    return new ApiEnvelope({ temCliente: true });
  }

  @Get('autorizar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PERFIS_SISTEMA)
  @ApiOperation({
    summary:
      'URL de consentimento do Google — o front navega o browser até ela',
  })
  autorizar() {
    const url = this.gmail.urlAutorizacao();
    if (!url)
      throw new UnprocessableEntityException(
        'Falta a credencial OAuth (envie o client JSON primeiro).',
      );
    return new ApiEnvelope({ url });
  }

  @Get('callback')
  @ApiOperation({
    summary:
      'Callback do OAuth do Google (rota pública, chamada pelo navegador após o consentimento)',
  })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') erro: string | undefined,
    @Res() res: Response,
  ) {
    const destino =
      process.env.MIGRACAO_FRONTEND_URL ?? 'http://localhost:4200';
    if (erro) {
      res.redirect(`${destino}/config/gmail?erro=${encodeURIComponent(erro)}`);
      return;
    }
    if (!code || !state)
      throw new BadRequestException(
        'code/state ausentes no callback do Google.',
      );
    const r = await this.gmail.trocarCodigoPorToken(code, state);
    if (r.ok) {
      res.redirect(`${destino}/config/gmail?autorizado=1`);
    } else {
      res.redirect(
        `${destino}/config/gmail?erro=${encodeURIComponent(r.erro ?? 'falha')}`,
      );
    }
  }
}
