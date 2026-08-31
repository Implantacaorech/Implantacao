import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PERFIS_GERA_LEVANTAMENTO } from '../common/constants/perfis';
import { LevantamentoRespostaService } from './levantamento-resposta.service';
import { LevantamentoPresencaService } from './levantamento-presenca.service';
import { DocConteudoService } from './doc-conteudo.service';
import { SugestaoLevantamentoService } from './sugestao-levantamento.service';
import { SalvarLinhaLevantamentoDto } from './dto/salvar-linha-levantamento.dto';
import { SincronizarLevantamentoDto } from './dto/sincronizar-levantamento.dto';
import { SugerirLevantamentoDto } from './dto/sugerir-levantamento.dto';
import type { DocumentoConteudo } from '../database/entities/doc-conteudo.entity';
import { ApiEnvelope } from '../common/dto/api-envelope';

/** Folga do relógio devolvida no `agora` da sincronização — ver comentário em `sincronizar`. */
const MARGEM_RELOGIO_MS = 3000;

@ApiTags('levantamento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_GERA_LEVANTAMENTO)
@Controller('projetos/:projetoId')
export class LevantamentoController {
  constructor(
    private readonly respostas: LevantamentoRespostaService,
    private readonly presenca: LevantamentoPresencaService,
    private readonly docConteudo: DocConteudoService,
    private readonly sugestoes: SugestaoLevantamentoService,
  ) {}

  @Get('levantamento')
  @ApiOperation({
    summary:
      'Questionário do Levantamento (semeia do Índice de Tópicos na 1ª vez) + resumo',
  })
  async levantamento(@Param('projetoId', ParseIntPipe) projetoId: number) {
    await this.respostas.garantirSeed(projetoId);
    const [linhas, resumo] = await Promise.all([
      this.respostas.listar(projetoId),
      this.respostas.resumo(projetoId),
    ]);
    return new ApiEnvelope({ linhas, resumo });
  }

  @Put('levantamento')
  @ApiOperation({
    summary:
      'Salva em lote as respostas do Levantamento — { [id]: resposta }. Uso administrativo/importação: a tela grava pergunta a pergunta pelo PATCH abaixo.',
  })
  async salvarLevantamento(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() respostas: Record<string, string>,
    @CurrentUser() user: AuthUser,
  ) {
    const n = await this.respostas.salvar(projetoId, respostas, user.nome);
    return new ApiEnvelope({ respondidas: n });
  }

  @Patch('levantamento/:linhaId')
  @ApiOperation({
    summary:
      'Salva UMA pergunta (autosave da tela colaborativa). 409 se outro técnico gravou antes.',
  })
  async salvarLinha(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('linhaId', ParseIntPipe) linhaId: number,
    @Body() dto: SalvarLinhaLevantamentoDto,
    @CurrentUser() user: AuthUser,
  ) {
    const linha = await this.respostas.salvarLinha(
      projetoId,
      linhaId,
      dto,
      user.nome,
    );
    const resumo = await this.respostas.resumo(projetoId);
    return new ApiEnvelope({ linha, resumo });
  }

  @Get('levantamento/gravacoes')
  @ApiOperation({
    summary:
      'Gravações do projeto que têm transcrição — a origem possível das sugestões',
  })
  async gravacoes(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return new ApiEnvelope({
      gravacoes: await this.sugestoes.gravacoes(projetoId),
      // A tela precisa saber ANTES de oferecer o botão: sem chave configurada em
      // Config → IA, o pedido só falharia depois do clique.
      iaDisponivel: this.sugestoes.disponivel(),
    });
  }

  @Post('levantamento/sugerir')
  @ApiOperation({
    summary:
      'Sugere as respostas pendentes a partir da transcrição da reunião. NÃO grava nada.',
  })
  async sugerir(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: SugerirLevantamentoDto,
    @CurrentUser() user: AuthUser,
  ) {
    // Propositalmente sem gravar: a resposta volta para a tela como PROPOSTA, e quem
    // responde é o GCI, pelo mesmo PATCH por linha de sempre (com versão e autoria). Um
    // documento de Levantamento é assinado pelo cliente — "quem escreveu isto?" não pode
    // ter como resposta "a IA, sozinha". O `user.nome` vai para a telemetria de IA (A10:
    // antes esta rota nem recebia @CurrentUser).
    return new ApiEnvelope(
      await this.sugestoes.sugerir(projetoId, dto.protocoloId, user.nome),
    );
  }

  @Post('levantamento/sincronizar')
  @ApiOperation({
    summary:
      'Tique da tela colaborativa: registra a presença deste técnico e devolve quem mais está na tela + as respostas alteradas desde `desde`.',
  })
  async sincronizar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: SincronizarLevantamentoDto,
    @CurrentUser() user: AuthUser,
  ) {
    const presentes = this.presenca.bater(
      projetoId,
      { id: user.sub, nome: user.nome },
      dto.linhaId ?? null,
    );
    // `agora` sai do servidor, não do navegador: o `desde` do próximo tique tem de estar no
    // relógio de quem filtra, senão máquina adiantada/atrasada perde ou repete alteração.
    // A margem para trás cobre dois furos de janela: a gravação do colega que cai entre esta
    // leitura e o próximo tique, e o `datetime` do MariaDB, que trunca no segundo. Repetir
    // uma linha é inofensivo (a tela reaplica o mesmo valor); perder é bug silencioso.
    const agora = new Date(Date.now() - MARGEM_RELOGIO_MS);
    const linhas = dto.desde
      ? await this.respostas.alteradasDesde(projetoId, new Date(dto.desde))
      : await this.respostas.listar(projetoId);
    const resumo = await this.respostas.resumo(projetoId);
    return new ApiEnvelope({
      presentes,
      linhas,
      resumo,
      agora: agora.toISOString(),
    });
  }

  @Delete('levantamento/presenca')
  @ApiOperation({ summary: 'Saída da tela — tira este técnico da presença.' })
  sairDaTela(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @CurrentUser() user: AuthUser,
  ) {
    this.presenca.sair(projetoId, user.sub);
    return new ApiEnvelope(null, 'Saiu.');
  }

  @Get('doc-conteudo/:doc')
  @ApiOperation({
    summary:
      'Campos estruturados de um documento (levantamento|projeto) por projeto',
  })
  docConteudoValores(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('doc') doc: DocumentoConteudo,
  ) {
    return this.docConteudo.valores(projetoId, doc);
  }

  @Put('doc-conteudo/:doc')
  @ApiOperation({
    summary: 'Salva campos estruturados de um documento (levantamento|projeto)',
  })
  async salvarDocConteudo(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('doc') doc: DocumentoConteudo,
    @Body() campos: Record<string, string>,
  ) {
    await this.docConteudo.salvar(projetoId, doc, campos);
    return new ApiEnvelope(null, 'Salvo.');
  }
}
