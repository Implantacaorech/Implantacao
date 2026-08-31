import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ProntidaoService } from './prontidao.service';

/**
 * Sistema → Prontidão do Sistema (`/api/prontidao`) — expõe a Auditoria de Prontidão dos 9
 * eixos de forma navegável no painel, com o estado ao vivo da privacidade da IA. Menu de
 * Sistema (chave `prontidao`, fixaAdm) — só o Administrador vê. Não acessa banco: é entrada e
 * saída, com a orquestração no `ProntidaoService` (Guia Mestre §13). Ver `docs/casos-de-uso.md`.
 */
@ApiTags('prontidao')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Controller('prontidao')
export class ProntidaoController {
  constructor(private readonly service: ProntidaoService) {}

  @Get()
  @Permissao('prontidao', 'consulta')
  @ApiOperation({
    summary:
      'Auditoria de Prontidão dos 9 eixos: veredito por eixo, achados por severidade/status e privacidade de IA ao vivo',
  })
  resumo() {
    return new ApiEnvelope(this.service.resumo());
  }
}
