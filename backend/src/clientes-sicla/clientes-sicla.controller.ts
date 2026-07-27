import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ClientesSiclaService } from './clientes-sicla.service';
import { CadastrarClienteDto } from './dto/cadastrar-cliente.dto';

/** Passo 1 do processo: consulta do cliente no SICLA e cadastro da ficha.
 *
 * Busca: aberta ao Comercial e aos perfis internos que acompanham a entrada. Cadastro: só o
 * Comercial (e o ADM) — o próprio serviço de passos reforça isso ao concluir o passo 1. */
@ApiTags('clientes-sicla')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clientes-sicla')
export class ClientesSiclaController {
  constructor(private readonly service: ClientesSiclaService) {}

  @Get('buscar')
  @Roles('ADM', 'Comercial', 'Administrativo', 'Coordenador')
  @ApiOperation({ summary: 'Busca clientes no SICLA por código ou descrição' })
  async buscar(@Query('termo') termo: string) {
    return new ApiEnvelope(await this.service.buscar(termo ?? ''));
  }

  @Post()
  @Roles('ADM', 'Comercial')
  @ApiOperation({
    summary: 'Cadastra o cliente (cria a ficha e conclui o passo 1)',
  })
  async cadastrar(
    @Body() dto: CadastrarClienteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.service.cadastrar(dto, {
        nome: user.nome,
        perfil: user.perfil,
        perfis: user.perfis,
      }),
    );
  }
}
