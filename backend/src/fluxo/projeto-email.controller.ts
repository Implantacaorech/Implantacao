import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ProjetoEmailService } from './projeto-email.service';
import { EnviarEmailProjetoDto } from './dto/enviar-email-projeto.dto';

/** E-mail avulso a partir da ficha do projeto (/projetos/:projetoId/email) — espelha
 * webapp/routes_fluxo.py:projeto_email.
 *
 * Achado A6 da auditoria de 2026-08-12: esta rota concluía com apenas `JwtAuthGuard`, então
 * QUALQUER usuário autenticado disparava um e-mail com destino/assunto/corpo arbitrários pela
 * infraestrutura do Painel (relay interno / vetor de phishing assinado pela empresa). Agora
 * exige a mesma permissão de `carteira` das demais escritas de projeto — leitura da tela em
 * `consulta`, envio em `alteracao`. */
@ApiTags('projeto-email')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Controller('projetos/:projetoId')
export class ProjetoEmailController {
  constructor(private readonly service: ProjetoEmailService) {}

  @Get('email')
  @Permissao('carteira', 'consulta')
  @ApiOperation({
    summary:
      'Dados da tela de e-mail: modelos ativos já renderizados + destino padrão',
  })
  async tela(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return new ApiEnvelope(await this.service.dadosTela(projetoId));
  }

  @Post('email')
  @HttpCode(HttpStatus.OK)
  @Permissao('carteira', 'alteracao')
  @ApiOperation({
    summary: 'Envia um e-mail avulso (com registro na timeline do projeto)',
  })
  async enviar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: EnviarEmailProjetoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.service.enviar(
        projetoId,
        dto.destino,
        dto.assunto,
        dto.corpo,
        user.nome,
      ),
    );
  }
}
