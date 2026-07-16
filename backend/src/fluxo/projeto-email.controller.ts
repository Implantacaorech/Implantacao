import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ProjetoEmailService } from './projeto-email.service';
import { EnviarEmailProjetoDto } from './dto/enviar-email-projeto.dto';

/** E-mail avulso a partir da ficha do projeto (/projetos/:projetoId/email) — espelha
 * webapp/routes_fluxo.py:projeto_email. */
@ApiTags('projeto-email')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projetos/:projetoId')
export class ProjetoEmailController {
  constructor(private readonly service: ProjetoEmailService) {}

  @Get('email')
  @ApiOperation({ summary: 'Dados da tela de e-mail: modelos ativos já renderizados + destino padrão' })
  async tela(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return new ApiEnvelope(await this.service.dadosTela(projetoId));
  }

  @Post('email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envia um e-mail avulso (com registro na timeline do projeto)' })
  async enviar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: EnviarEmailProjetoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.service.enviar(projetoId, dto.destino, dto.assunto, dto.corpo, user.nome));
  }
}
