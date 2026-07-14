import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ImapIntakeService } from './imap-intake.service';
import { SalvarConfigImapDto } from './dto/salvar-config-imap.dto';

/** Config → Caixa de entrada (IMAP) — exclusivo do Administrador. Espelha
 * webapp/routes_config.py:config_imap. */
@ApiTags('config-imap')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/imap')
export class ConfigImapController {
  constructor(private readonly imap: ImapIntakeService) {}

  @Get()
  @ApiOperation({ summary: 'Status/config atual do IMAP (nunca devolve a senha)' })
  status() {
    const { senha: _senha, ...cfg } = this.imap.carregarConfig();
    return new ApiEnvelope({ ...cfg, configurado: this.imap.configurado() });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva a configuração IMAP' })
  salvar(@Body() dto: SalvarConfigImapDto) {
    const { senha: _senha, ...cfg } = this.imap.salvarConfig(dto);
    return new ApiEnvelope({ ...cfg, configurado: this.imap.configurado() });
  }
}
