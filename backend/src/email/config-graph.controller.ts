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
import { GraphService } from './graph.service';
import { SalvarConfigGraphDto } from './dto/salvar-config-graph.dto';

/** Config → E-mail (Microsoft 365) — exclusivo do Administrador. Guarda as credenciais do
 * registro de aplicativo no Entra ID que o TI fornece; o segredo NUNCA volta nas respostas,
 * mesmo padrão de ConfigEmailController com a senha do SMTP. */
@ApiTags('config-graph')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/graph')
export class ConfigGraphController {
  constructor(private readonly graph: GraphService) {}

  @Get()
  @ApiOperation({
    summary: 'Status/config atual do Microsoft Graph (nunca devolve o segredo)',
  })
  status() {
    const { clientSecret: _s, ...cfg } = this.graph.carregarConfig();
    return new ApiEnvelope({
      ...cfg,
      // A tela precisa saber se há segredo guardado para explicar que deixar o campo em
      // branco mantém o atual — sem nunca expor o valor.
      temSegredo: Boolean(_s),
      configurado: this.graph.configurado(),
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva as credenciais do Microsoft Graph' })
  salvar(@Body() dto: SalvarConfigGraphDto) {
    const { clientSecret: _s, ...cfg } = this.graph.salvarConfig(dto);
    return new ApiEnvelope({
      ...cfg,
      temSegredo: Boolean(_s),
      configurado: this.graph.configurado(),
    });
  }
}
