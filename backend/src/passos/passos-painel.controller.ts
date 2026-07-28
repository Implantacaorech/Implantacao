import {
  BadRequestException,
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { PassosService } from './passos.service';
import { PASSOS } from './passos.constants';
import { PERFIS, Perfil } from '../common/constants/perfis';
import { UsersService } from '../users/users.service';

/** Dados do PROCESSO para a carteira (quadro por fase), não de um projeto específico.
 *
 * Separado de `PassosController` porque aquele é `projetos/:id` — aqui a pergunta é sobre
 * todos os projetos de uma vez. */
@ApiTags('passos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('passos')
export class PassosPainelController {
  constructor(
    private readonly passos: PassosService,
    private readonly users: UsersService,
  ) {}

  @Get('definicoes')
  @Roles()
  @ApiOperation({
    summary:
      'Os 18 passos do processo (número, título, macro-etapa, responsável)',
  })
  definicoes() {
    return new ApiEnvelope(PASSOS);
  }

  @Get('pessoas-por-papel/:papel')
  @Roles()
  @ApiOperation({
    summary:
      'Nomes dos usuários ativos que TÊM o papel — alimenta os seletores dos passos',
  })
  async pessoasPorPapel(@Param('papel') papel: string) {
    const alvo = (PERFIS as readonly string[]).includes(papel)
      ? (papel as Perfil)
      : null;
    if (!alvo) throw new BadRequestException(`Papel "${papel}" não existe.`);
    const usuarios = await this.users.porPerfil(alvo);
    return new ApiEnvelope(usuarios.map((u) => u.nome).sort());
  }

  @Get('atuais')
  @Roles()
  @ApiOperation({
    summary: 'Em que passo cada projeto está — alimenta o quadro por fase',
  })
  async atuais() {
    return new ApiEnvelope(await this.passos.passoAtualDeTodos());
  }

  @Get('grade')
  @Roles()
  @ApiOperation({
    summary:
      'Grade Cliente × fases: status de cada passo por projeto (realizado/andamento/não)',
  })
  async grade() {
    return new ApiEnvelope(await this.passos.gradeDeTodos());
  }
}
