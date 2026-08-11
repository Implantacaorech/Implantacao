import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { SaudeService } from './saude.service';

/** Diagnóstico da infraestrutura do próprio Painel.
 *
 * Vive sob a permissão **`centro_operacional`**, a mesma do Centro de Monitoramento, e não
 * numa chave nova: é o mesmo público (quem opera) e o mesmo lugar na tela. Chave de
 * permissão nova exigiria semear a tabela de RBAC, e ninguém lembraria de liberá-la.
 *
 * Não confundir com `GET /api/health`, que é público e responde em uma linha para o
 * Guardião. Aqui é o relatório para gente ler. */
@ApiTags('saude')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Controller('saude')
export class SaudeController {
  constructor(private readonly saude: SaudeService) {}

  @Get()
  @Permissao('centro_operacional')
  @ApiOperation({
    summary:
      'Saúde da infraestrutura: banco, backup, Guardião, docservice, transcrições e e-mail',
  })
  async diagnostico() {
    return new ApiEnvelope(await this.saude.diagnostico());
  }
}
