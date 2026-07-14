import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ModeloEmailService } from './modelo-email.service';
import { SalvarModeloEmailDto } from './dto/salvar-modelo-email.dto';

/** Config → Modelos de E-mail (CRUD) — exclusivo do Administrador. Espelha
 * webapp/routes_config.py:config_modelos_email*. */
@ApiTags('modelos-email')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/modelos-email')
export class ModeloEmailController {
  constructor(private readonly modelos: ModeloEmailService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os modelos de e-mail' })
  async listar(@Query('apenasAtivos') apenasAtivos?: string) {
    const itens = await this.modelos.listar(apenasAtivos !== 'false');
    return new ApiEnvelope({ itens });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um modelo de e-mail' })
  async obter(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.modelos.obter(id));
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cria um modelo de e-mail' })
  async criar(@Body() dto: SalvarModeloEmailDto) {
    if (!(dto.nome || '').trim()) {
      throw new BadRequestException('O nome do modelo é obrigatório.');
    }
    return new ApiEnvelope(await this.modelos.salvar(dto));
  }

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualiza um modelo de e-mail' })
  async atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: SalvarModeloEmailDto) {
    if (!(dto.nome || '').trim()) {
      throw new BadRequestException('O nome do modelo é obrigatório.');
    }
    return new ApiEnvelope(await this.modelos.salvar(dto, id));
  }

  @Post(':id/excluir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exclui um modelo (modelos padrão não podem ser excluídos)' })
  async excluir(@Param('id', ParseIntPipe) id: number) {
    const r = await this.modelos.excluir(id);
    if (!r.ok) throw new BadRequestException(r.erro ?? 'Falha ao excluir.');
    return new ApiEnvelope({ excluido: true });
  }

  @Post(':id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativa/desativa um modelo sem excluí-lo' })
  async alternarAtivo(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.modelos.alternarAtivo(id));
  }
}
