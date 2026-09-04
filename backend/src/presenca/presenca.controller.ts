import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { PresencaService } from './presenca.service';
import { PingDto, SairDto } from './dto/presenca.dto';

/** Controle de acessos — quem está no Painel agora e em que tela.
 *
 * **A batida é de qualquer autenticado; a LISTA é só do Administrador.** As duas coisas
 * moram no mesmo controller mas com gates diferentes: todo mundo precisa poder anunciar a
 * própria presença, e ninguém além do ADM precisa ver a dos outros. O `RolesGuard` deixa
 * passar rota sem `@Roles`, o que permite essa mistura sem dois controllers. */
@ApiTags('presenca')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('presenca')
export class PresencaController {
  constructor(private readonly presenca: PresencaService) {}

  @Post('ping')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Anuncia que estou aqui, e em que tela' })
  async ping(
    @CurrentUser() user: AuthUser,
    @Body() dto: PingDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.presenca.registrar(
      user,
      { ...dto, visivel: dto.visivel ?? true },
      enderecoDe(req),
      String(req.headers['user-agent'] ?? ''),
    );
  }

  @Post('sair')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerra a sessão desta aba (logout)' })
  async sair(
    @CurrentUser() user: AuthUser,
    @Body() dto: SairDto,
  ): Promise<void> {
    await this.presenca.encerrar(user.sub, dto.sessao);
  }

  @Get()
  @Roles('ADM')
  @ApiOperation({
    summary: 'Quem está online agora, e em que tela (só Administrador)',
  })
  async panorama() {
    return new ApiEnvelope(await this.presenca.panorama());
  }

  @Get('quantos')
  @Roles('ADM')
  @ApiOperation({ summary: 'Só o número de pessoas online — o selo do botão' })
  async quantos() {
    return new ApiEnvelope({ online: await this.presenca.quantosOnline() });
  }
}

/** IP de quem chamou.
 *
 * Hoje o Painel é acessado direto, então `req.ip` basta. `x-forwarded-for` é lido primeiro
 * porque a virada para o servidor na nuvem provavelmente põe um proxy na frente — e, sem
 * isso, a tela mostraria o IP do proxy para todo mundo. Só o primeiro endereço da lista
 * interessa: os demais são os saltos intermediários. */
function enderecoDe(req: Request): string {
  const encaminhado = req.headers['x-forwarded-for'];
  const bruto = Array.isArray(encaminhado) ? encaminhado[0] : encaminhado;
  const primeiro = (bruto ?? '').split(',')[0].trim();
  return primeiro || req.ip || '';
}
