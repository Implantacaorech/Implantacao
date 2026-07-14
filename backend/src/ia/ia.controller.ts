import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { IaService } from './ia.service';
import { SalvarChaveIaDto } from './dto/salvar-chave-ia.dto';

/** Tela Config → IA — exclusivo do Administrador (`pode_ver("sistema")` no Flask).
 * Espelha webapp/routes_config.py:config(). */
@ApiTags('config-ia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/ia')
export class IaController {
  constructor(private readonly ia: IaService) {}

  @Get()
  @ApiOperation({ summary: 'Status da chave de IA (Anthropic) configurada' })
  status() {
    return new ApiEnvelope({
      ativa: this.ia.disponivel(),
      modelo: this.ia.modelo,
      viaEnv: this.ia.viaEnv(),
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva (ou remove, se vazia) a chave de IA (Anthropic)' })
  salvar(@Body() dto: SalvarChaveIaDto) {
    this.ia.salvarChave(dto.apiKey);
    return new ApiEnvelope({
      ativa: this.ia.disponivel(),
      modelo: this.ia.modelo,
      viaEnv: this.ia.viaEnv(),
    });
  }
}
