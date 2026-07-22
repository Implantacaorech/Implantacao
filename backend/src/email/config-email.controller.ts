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
import { MailerService } from './mailer.service';
import { SalvarConfigSmtpDto } from './dto/salvar-config-smtp.dto';

/** Config → E-mail (SMTP) — exclusivo do Administrador. Espelha
 * webapp/routes_config.py:config_email. */
@ApiTags('config-email')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/email')
export class ConfigEmailController {
  constructor(private readonly mailer: MailerService) {}

  @Get()
  @ApiOperation({
    summary: 'Status/config atual do SMTP (nunca devolve a senha)',
  })
  status() {
    const { senha: _senha, ...cfg } = this.mailer.carregarConfig();
    return new ApiEnvelope({ ...cfg, configurado: this.mailer.configurado() });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva a configuração SMTP' })
  salvar(@Body() dto: SalvarConfigSmtpDto) {
    const { senha: _senha, ...cfg } = this.mailer.salvarConfig(dto);
    return new ApiEnvelope({ ...cfg, configurado: this.mailer.configurado() });
  }
}
