import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PERFIS_AGENDAMENTO } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { PassosService } from './passos.service';
import { RnsService } from './rns.service';
import {
  AtualizarRnsDto,
  ConcluirPassoDto,
  DefinirPessoasDto,
  RnsDto,
} from './dto/passos.dto';

/** Os 18 passos operacionais do processo, por projeto.
 *
 * O gate de QUEM pode concluir cada passo não fica aqui: é do próprio passo (ver
 * `PERFIS_POR_RESPONSAVEL` em passos.constants.ts) e é verificado no serviço, porque varia
 * de passo para passo. Por isso `@Roles()` está vazio nas rotas de conclusão — qualquer
 * autenticado alcança a rota, e o serviço recusa quem não é o responsável. */
@ApiTags('passos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projetos/:id')
export class PassosController {
  constructor(
    private readonly passos: PassosService,
    private readonly rns: RnsService,
  ) {}

  @Get('passos')
  @Roles()
  @ApiOperation({ summary: 'Os 18 passos do projeto e o estado de cada um' })
  async listar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.passos.listar(id, user.perfil));
  }

  @Post('passos/:numero/concluir')
  @Roles()
  @ApiOperation({ summary: 'Conclui um passo (só o responsável consegue)' })
  async concluir(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @Body() dto: ConcluirPassoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.passos.concluir(
        id,
        numero,
        { nome: user.nome, perfil: user.perfil },
        dto.observacao ?? '',
      ),
    );
  }

  @Post('passos/:numero/conferir')
  @Roles()
  @ApiOperation({
    summary: 'Marca a conferência (passos 9 e 16) e libera o passo seguinte',
  })
  async conferir(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.passos.conferir(id, numero, {
        nome: user.nome,
        perfil: user.perfil,
      }),
    );
  }

  @Delete('passos/:numero')
  @Roles()
  @ApiOperation({
    summary: 'Reabre um passo REVERSÍVEL (do 11 em diante é definitivo)',
  })
  async reabrir(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.passos.reabrir(id, numero, {
        nome: user.nome,
        perfil: user.perfil,
      }),
    );
  }

  @Get('pessoas')
  @Roles()
  @ApiOperation({ summary: 'Levantadores e consultores do projeto' })
  async pessoas(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope({
      levantadores: await this.passos.pessoasDoProjeto(id, 'levantador'),
      consultores: await this.passos.pessoasDoProjeto(id, 'consultor'),
    });
  }

  @Patch('pessoas')
  @Roles('ADM', 'Coordenador', 'Administrativo')
  @ApiOperation({
    summary: 'Define a lista de levantadores ou de consultores (aceita vários)',
  })
  async definirPessoas(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirPessoasDto,
  ) {
    return new ApiEnvelope(
      await this.passos.definirPessoas(id, dto.papel, dto.pessoas),
    );
  }

  @Get('rns')
  @Roles()
  @ApiOperation({ summary: 'RNS do projeto (RNI, COB e Conversão)' })
  async listarRns(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.rns.listar(id));
  }

  @Post('rns')
  @Roles(...PERFIS_AGENDAMENTO)
  @ApiOperation({ summary: 'Acrescenta uma RNS (a quantidade é livre)' })
  async criarRns(@Param('id', ParseIntPipe) id: number, @Body() dto: RnsDto) {
    return new ApiEnvelope(await this.rns.acrescentar(id, dto));
  }

  @Patch('rns/:rnsId')
  @Roles(...PERFIS_AGENDAMENTO)
  @ApiOperation({ summary: 'Altera uma RNS do projeto' })
  async atualizarRns(
    @Param('id', ParseIntPipe) id: number,
    @Param('rnsId', ParseIntPipe) rnsId: number,
    @Body() dto: AtualizarRnsDto,
  ) {
    return new ApiEnvelope(await this.rns.atualizar(id, rnsId, dto));
  }

  @Delete('rns/:rnsId')
  @Roles(...PERFIS_AGENDAMENTO)
  @ApiOperation({ summary: 'Remove uma RNS do projeto' })
  async removerRns(
    @Param('id', ParseIntPipe) id: number,
    @Param('rnsId', ParseIntPipe) rnsId: number,
  ) {
    await this.rns.remover(id, rnsId);
    return new ApiEnvelope({ ok: true });
  }
}
