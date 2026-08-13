import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LIMITE_UPLOAD_DOC } from '../common/upload.constants';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
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

/** Os 21 passos operacionais do processo, por projeto.
 *
 * O gate de QUEM pode concluir cada passo não fica aqui: é do próprio passo (ver
 * `PERFIS_POR_RESPONSAVEL` em passos.constants.ts) e é verificado no serviço, porque varia
 * de passo para passo. Por isso `@Roles()` está vazio nas rotas de conclusão — qualquer
 * autenticado alcança a rota, e o serviço recusa quem não é o responsável. */
@ApiTags('passos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Permissao('carteira')
@Controller('projetos/:id')
export class PassosController {
  constructor(
    private readonly passos: PassosService,
    private readonly rns: RnsService,
  ) {}

  @Get('passos')
  @Roles()
  @ApiOperation({ summary: 'Os 21 passos do projeto e o estado de cada um' })
  async listar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    // `user` INTEIRO, nunca um recorte. Recortar `{ nome, perfil }` descartava `perfis` e
    // rebaixava todo mundo ao papel PRINCIPAL: o GCI que também é Levantador perdia o papel
    // de Levantador e o Painel dizia "só o responsável (Levantador) pode concluir" para a
    // pessoa certa (bug em produção, diagnosticado em 2026-07-29).
    return new ApiEnvelope(await this.passos.listar(id, user));
  }

  /** Concluir o PRÓPRIO passo não é "editar a carteira".
   *
   * Esta rota exigia `carteira/alteracao`, mas o Comercial tem nível `consulta` nesse menu
   * (`PADRAO_PERMISSOES`) — e os passos 1 e 5 são DELE. Como o passo 5 não tem caminho
   * automático, todo projeto travava ali até um ADM concluir por fora, enquanto
   * `GET /passos` seguia informando `liberado: true` (achado de 2026-08-05).
   *
   * O gate correto já existe e é mais estrito: `PassosService.podeExecutar` exige o perfil
   * responsável pelo passo E a designação naquele projeto (RN-10). O nível de menu volta a
   * ser o que ele é — quem vê a carteira alcança a rota; quem responde pelo passo conclui. */
  @Post('passos/:numero/concluir')
  @Roles()
  @Permissao('carteira')
  @ApiOperation({ summary: 'Conclui um passo (só o responsável consegue)' })
  async concluir(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @Body() dto: ConcluirPassoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.passos.concluir(id, numero, user, {
        observacao: dto.observacao,
        marcado: dto.marcado,
        dataMarcada: dto.dataMarcada,
        email: dto.email,
      }),
    );
  }

  @Get('passos/:numero/email')
  @Roles()
  @ApiOperation({
    summary: 'Pré-visualiza o e-mail do passo, para revisar antes de enviar',
  })
  async previaEmail(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    // A descrição que a pessoa está digitando AGORA (passo 5). Sem ela, a prévia sai com o
    // token `{{DESCRICAO_PASSO}}` resolvido em BRANCO — e como a tela devolve esse corpo já
    // montado, a descrição do Comercial nunca chegava ao Administrativo (RN-7).
    @Query('descricao') descricao?: string,
  ) {
    return new ApiEnvelope(
      await this.passos.previaEmail(id, numero, descricao),
    );
  }

  @Get('emails')
  @Roles()
  @ApiOperation({
    summary:
      'E-mails já gerados no projeto, por passo — consulta liberada a quem vê a carteira',
  })
  async emails(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.passos.historicoDeEmails(id));
  }

  @Post('emails/:emailId/reenviar')
  @Roles()
  @Permissao('carteira', 'alteracao')
  @ApiOperation({
    summary:
      'Reenvia um e-mail de passo que falhou (A13) — grava uma nova linha no histórico com o resultado',
  })
  async reenviarEmail(
    @Param('id', ParseIntPipe) id: number,
    @Param('emailId', ParseIntPipe) emailId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.passos.reenviarEmail(id, emailId, user.nome),
    );
  }

  @Post('passos/:numero/conferir')
  @Roles()
  @Permissao('carteira', 'alteracao')
  @ApiOperation({
    summary: 'Marca a conferência (passos 11 e 19) e libera o passo seguinte',
  })
  async conferir(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.passos.conferir(id, numero, user));
  }

  @Delete('passos/:numero')
  @Roles()
  @Permissao('carteira', 'alteracao')
  @ApiOperation({
    summary: 'Reabre um passo REVERSÍVEL (do 11 em diante é definitivo)',
  })
  async reabrir(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.passos.reabrir(id, numero, user));
  }

  @Post('passos/:numero/anexar-email')
  @Roles()
  @Permissao('carteira', 'alteracao')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: LIMITE_UPLOAD_DOC } }),
  )
  @ApiOperation({
    summary:
      'Anexa o e-mail encaminhado do Outlook (.msg/.eml) — registro dos passos 4 e 6',
  })
  async anexarEmail(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!arquivo) {
      throw new BadRequestException(
        'Selecione o e-mail encaminhado (.msg ou .eml).',
      );
    }
    return new ApiEnvelope(
      await this.passos.anexarEmail(id, numero, arquivo, user),
    );
  }

  @Post('passos/:numero/anexo-email')
  @Roles()
  @Permissao('carteira', 'alteracao')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: LIMITE_UPLOAD_DOC } }),
  )
  @ApiOperation({
    summary:
      'Anexa um arquivo AO E-MAIL que o passo vai enviar (passo 16) — some do e-mail, não é ' +
      'prova de envio externo como o /anexar-email dos passos 4 e 6',
  })
  async anexarArquivoDoEmail(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!arquivo) throw new BadRequestException('Selecione um arquivo.');
    return new ApiEnvelope(
      await this.passos.anexarArquivoDoEmail(id, numero, arquivo, user),
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
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      // `user` inteiro, e não só o nome: é ele que decide se salvar a equipe também FECHA o
      // passo 8 — que é do Coordenador, embora esta rota aceite o Administrativo.
      await this.passos.definirPessoas(
        id,
        dto.papel,
        dto.pessoas,
        user.nome,
        user,
      ),
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
