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
import { PortalDbService } from './portal-db.service';
import { SalvarPortalDbDto } from './dto/salvar-portal-db.dto';

/** Conexão com o BANCO DO PORTAL RECH (MySQL) — cadastrada pelo Administrador na tela
 * Consultas BD (área Sistema), ao lado das consultas que rodam nela. Mesma restrição do
 * ConfigConsultasBdController (só ADM); a senha NUNCA volta nas respostas. */
@ApiTags('config-portal-db')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/portal-db')
export class ConfigPortalDbController {
  constructor(private readonly portalDb: PortalDbService) {}

  private semSenha() {
    const { senha, ...resto } = this.portalDb.carregarConfig();
    return { ...resto, temSenha: Boolean(senha) };
  }

  @Get()
  @ApiOperation({ summary: 'Configuração da conexão (sem a senha)' })
  obter() {
    return new ApiEnvelope(this.semSenha());
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Salva a conexão (senha em branco mantém a atual)',
  })
  salvar(@Body() dto: SalvarPortalDbDto) {
    this.portalDb.salvarConfig(dto);
    return new ApiEnvelope(this.semSenha());
  }

  @Post('testar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Testa a conexão cadastrada (SELECT 1)' })
  async testar() {
    return new ApiEnvelope(await this.portalDb.testar());
  }
}
