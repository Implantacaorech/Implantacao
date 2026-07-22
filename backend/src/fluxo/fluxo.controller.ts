import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiEnvelope } from '../common/dto/api-envelope';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ImapIntakeService } from './imap-intake.service';
import { FluxoService } from './fluxo.service';
import { MailerService } from '../email/mailer.service';
import { ParseFechamentoDto } from './dto/parse-fechamento.dto';
import { CriarFechamentoDto } from './dto/criar-fechamento.dto';
import { MODELO_FECHAMENTO } from './fluxo.constants';

/** Onboarding a partir do e-mail de fechamento do Comercial (/fluxo/*) — qualquer
 * usuário autenticado (mesmo padrão de acesso do Flask original, sem `pode_ver`
 * adicional além do login). Espelha webapp/routes_fluxo.py. `criar` gera o pacote
 * inicial completo (Mapeamento + Cronograma pela "layout fiel" nova, Check List pelo
 * gerador legado via LegadoCliService) e envia o e-mail-resumo com anexos. */
@ApiTags('fluxo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fluxo')
export class FluxoController {
  constructor(
    private readonly imap: ImapIntakeService,
    private readonly fluxo: FluxoService,
    private readonly mailer: MailerService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Status do fluxo: IMAP/SMTP configurados, modelo de e-mail de fechamento',
  })
  status() {
    return new ApiEnvelope({
      imapConfigurado: this.imap.configurado(),
      smtpConfigurado: this.mailer.configurado(),
      modeloFechamento: MODELO_FECHAMENTO,
    });
  }

  @Post('parse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Extrai os campos de um texto colado (sem consultar o IMAP)',
  })
  parse(@Body() dto: ParseFechamentoDto) {
    const campos = this.fluxo.paraProjeto(
      this.fluxo.parseFechamento(dto.texto),
    );
    return new ApiEnvelope({ campos });
  }

  @Post('inbox')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Busca o e-mail de fechamento mais recente não lido via IMAP (não marca como lido)',
  })
  async inbox() {
    const { corpo, assunto, erro } = await this.imap.buscarFechamento();
    if (erro || corpo === null) {
      return new ApiEnvelope({ encontrado: false, erro });
    }
    const campos = this.fluxo.paraProjeto(this.fluxo.parseFechamento(corpo));
    return new ApiEnvelope({ encontrado: true, assunto, campos });
  }

  @Post('criar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cria o projeto a partir dos campos confirmados/editados, gera o pacote inicial e envia o e-mail-resumo aos responsáveis',
  })
  async criar(@Body() dto: CriarFechamentoDto, @CurrentUser() user: AuthUser) {
    const resultado = await this.fluxo.criarComPacote(dto, user.nome);
    return new ApiEnvelope(resultado);
  }
}
