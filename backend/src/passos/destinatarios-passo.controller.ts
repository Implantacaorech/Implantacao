import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { DestinatariosPassoService } from './destinatarios-passo.service';
import { DestinatariosPassoDto } from './dto/passos.dto';

/** Para quem vai o e-mail de cada passo — Sistema → Ferramentas → Destinatários por Passo.
 *
 * Só ADM: mexer aqui muda para quem o Painel escreve em nome da empresa, em todos os
 * projetos de uma vez. É a mesma régua dos Modelos de E-mail e das Consultas BD. */
@ApiTags('config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADM')
@Controller('config/destinatarios-passo')
export class DestinatariosPassoController {
  constructor(private readonly service: DestinatariosPassoService) {}

  @Get()
  @ApiOperation({
    summary:
      'Destinatários de cada passo que envia e-mail, com o padrão aplicado',
  })
  async listar() {
    return new ApiEnvelope({
      passos: await this.service.listar(),
      grupos: this.service.gruposDisponiveis(),
    });
  }

  @Put(':passo')
  @ApiOperation({ summary: 'Grava os destinatários de um passo' })
  async salvar(
    @Param('passo', ParseIntPipe) passo: number,
    @Body() dto: DestinatariosPassoDto,
  ) {
    return new ApiEnvelope(await this.service.salvar(passo, dto));
  }

  @Delete(':passo')
  @ApiOperation({ summary: 'Volta o passo ao destinatário padrão do código' })
  async restaurar(@Param('passo', ParseIntPipe) passo: number) {
    return new ApiEnvelope(await this.service.restaurarPadrao(passo));
  }
}
