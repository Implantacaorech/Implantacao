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
import { DisponibilidadeService } from './disponibilidade.service';
import { ConexaoSiclaService } from '../dados/conexoes/conexao-sicla.service';
import { SalvarConfigDisponibilidadeDto } from './dto/salvar-config-disponibilidade.dto';

/** Config → Disponibilidade (banco externo — SICLA/Oracle) — exclusivo do Administrador.
 * Espelha webapp/routes_config.py:config_disponibilidade. */
@ApiTags('config-disponibilidade')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/disponibilidade')
export class ConfigDisponibilidadeController {
  constructor(
    // A CONFIGURAÇÃO da conexão (credenciais, SELECTs) mora com o driver, em
    // dados/conexoes/ — esta tela só a edita. O `testar` continua sendo do domínio: o que
    // ele prova é que a ocupação volta, não que o TCP abriu.
    private readonly conexao: ConexaoSiclaService,
    private readonly disponibilidade: DisponibilidadeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Status/config atual (nunca devolve a senha)' })
  status() {
    const { senha: _senha, ...cfg } = this.conexao.carregarConfig();
    return new ApiEnvelope({
      ...cfg,
      configurado: this.conexao.configurado(),
    });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva a configuração da conexão externa' })
  salvar(@Body() dto: SalvarConfigDisponibilidadeDto) {
    const { senha: _senha, ...cfg } = this.conexao.salvarConfig(dto);
    return new ApiEnvelope({
      ...cfg,
      configurado: this.conexao.configurado(),
    });
  }

  @Post('testar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Testa a conexão + consulta numa janela de 30 dias',
  })
  async testar() {
    const r = await this.disponibilidade.testar();
    return new ApiEnvelope(r);
  }
}
