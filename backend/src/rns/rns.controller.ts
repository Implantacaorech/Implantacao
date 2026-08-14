import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { RnsService } from './rns.service';
import { QueryConsultaRnsDto } from './dto/query-consulta-rns.dto';

/** Tela **Execução → RNS** — consulta de assuntos nas RNS do SICLA (`LISTA_ITEMPED`).
 * Gate pelo menu `rns`: só leitura, então o nível `consulta` (default do decorator) basta
 * para tudo que existe aqui. */
@ApiTags('rns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('rns')
@Controller('rns')
export class RnsController {
  constructor(private readonly servico: RnsService) {}

  @Get()
  @ApiOperation({
    summary:
      'RNS (Pedido + Item) criadas numa janela de datas — a busca por assunto é da tela',
  })
  async consultar(@Query() query: QueryConsultaRnsDto) {
    return new ApiEnvelope(await this.servico.consultar(query));
  }
}
