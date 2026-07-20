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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { IaService } from './ia.service';
import { SalvarChaveIaDto } from './dto/salvar-chave-ia.dto';
import { PROVEDORES_IA } from './ia.constants';

/** Tela Config → IA (Ferramentas → Modo IA) — exclusivo do Administrador. Configura as chaves
 * de IA POR FINALIDADE (Protocolos, Dicionário…), cada uma com provedor próprio
 * (Anthropic ou OpenRouter) e modelo. Espelha webapp/routes_config.py:config(). */
@ApiTags('config-ia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/ia')
export class IaController {
  constructor(private readonly ia: IaService) {}

  @Get()
  @ApiOperation({
    summary: 'Status das chaves de IA por finalidade + provedores suportados',
  })
  status() {
    return new ApiEnvelope({
      provedores: PROVEDORES_IA,
      finalidades: this.ia.statusTodas(),
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Salva (ou remove, se a chave vier vazia) a configuração de uma finalidade',
  })
  salvar(@Body() dto: SalvarChaveIaDto) {
    this.ia.salvar(dto.finalidade, {
      provider: dto.provider,
      apiKey: dto.apiKey,
      modelo: dto.modelo,
    });
    return new ApiEnvelope({
      provedores: PROVEDORES_IA,
      finalidades: this.ia.statusTodas(),
    });
  }
}
