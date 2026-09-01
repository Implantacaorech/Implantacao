import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ContatosSiclaService } from './contatos-sicla.service';
import { LiberarContatosDto } from './dto/liberar-contatos.dto';
import { RevogarContatosDto } from './dto/revogar-contatos.dto';

/** Acesso de Clientes: quem, do lado do cliente, entra no Painel.
 *
 * Exclusivo do Administrador, como a tela de Usuários — dar acesso externo é decisão de
 * sistema. O que o ADM faz aqui é conceder CONTA a quem o SICLA já autorizou
 * (`PORTAL_RECH_CLIENTES = 1`); a autorização em si nunca nasce nesta tela. */
@ApiTags('contatos-sicla')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('contatos-sicla')
export class ContatosSiclaController {
  constructor(private readonly service: ContatosSiclaService) {}

  @Get()
  @ApiOperation({
    summary:
      'Contatos liberados no SICLA (LISTA_CONTATOS). `cliente` recorta um cliente; `termo` filtra; `novos=1` traz só quem ainda não tem acesso',
  })
  async listar(
    @Query('cliente') cliente?: string,
    @Query('termo') termo?: string,
    @Query('novos') novos?: string,
  ) {
    const somenteNaoLiberados = novos === '1' || novos === 'true';
    return new ApiEnvelope(
      await this.service.listar(cliente, termo ?? '', somenteNaoLiberados),
    );
  }

  @Post('liberar')
  @ApiOperation({
    summary:
      'Dá acesso ao Painel aos contatos indicados (senha aleatória; o contato define a dele por "Esqueci minha senha")',
  })
  async liberar(@Body() dto: LiberarContatosDto) {
    return new ApiEnvelope(await this.service.liberar(dto.cliente, dto.emails));
  }

  @Post('revogar')
  @ApiOperation({
    summary: 'Tira o acesso (desativa o usuário; o histórico permanece)',
  })
  async revogar(@Body() dto: RevogarContatosDto) {
    return new ApiEnvelope(await this.service.revogar(dto.emails));
  }
}
