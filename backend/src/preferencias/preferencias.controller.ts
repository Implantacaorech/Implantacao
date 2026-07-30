import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { PreferenciasService } from './preferencias.service';
import { SalvarPreferenciaDto } from './dto/salvar-preferencia.dto';

/** Preferências de tela do usuário logado — a seleção de filtros que cada tela guarda.
 *
 * SÓ `JwtAuthGuard`, sem `@Permissao`: de propósito. Isto não é dado de negócio, é o ajuste
 * de tela de quem está usando o Painel — quem consegue abrir a tela consegue guardar como
 * gosta de vê-la. O escopo é garantido pelo `sub` do token: as três rotas usam SEMPRE
 * `user.sub` como dono, e não existe parâmetro de usuário para apontar para outra pessoa. */
@ApiTags('preferencias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('preferencias')
export class PreferenciasController {
  constructor(private readonly preferencias: PreferenciasService) {}

  @Get()
  @ApiOperation({
    summary: 'Todas as preferências (filtros salvos) do usuário logado',
  })
  async minhas(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope({
      preferencias: await this.preferencias.todas(user.sub),
    });
  }

  @Put(':chave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grava a preferência de uma tela' })
  async salvar(
    @CurrentUser() user: AuthUser,
    @Param('chave') chave: string,
    @Body() dto: SalvarPreferenciaDto,
  ) {
    await this.preferencias.salvar(user.sub, chave, dto.valor);
    return new ApiEnvelope({ salvo: true });
  }

  @Delete(':chave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Descarta a preferência de uma tela' })
  async remover(@CurrentUser() user: AuthUser, @Param('chave') chave: string) {
    await this.preferencias.remover(user.sub, chave);
    return new ApiEnvelope({ removido: true });
  }
}
