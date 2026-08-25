import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClienteApiService } from './cliente-api.service';
import { ConsultasPublicadasService } from './consultas-publicadas.service';
import { DadosService } from './dados.service';
import {
  AnalisarConsultaDto,
  SalvarConsultaPublicadaDto,
} from './dto/consulta-publicada.dto';
import {
  AtualizarClienteApiDto,
  CriarClienteApiDto,
  DefinirAtivoDto,
} from './dto/cliente-api.dto';

/** Administração da API de Dados — clientes de máquina, uso e cache. Restrito ao
 * Administrador, como as demais telas da área Sistema.
 *
 * Fica em rota separada (`/admin`) e sob os guards de PESSOA de propósito: quem administra
 * a API nunca é um cliente de máquina. Uma chave comprometida não consegue emitir outra. */
@ApiTags('dados-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('dados/v1/admin')
export class DadosAdminController {
  constructor(
    private readonly clientes: ClienteApiService,
    private readonly dados: DadosService,
    private readonly publicadas: ConsultasPublicadasService,
  ) {}

  // ── Consultas criadas pela TELA ────────────────────────────────────────────────────

  @Get('consultas')
  @ApiOperation({ summary: 'Consultas salvas, com os campos de publicação' })
  async listarConsultas() {
    return new ApiEnvelope(await this.publicadas.listar());
  }

  @Get('consultas/:slug')
  @ApiOperation({ summary: 'Uma consulta salva, para edição' })
  async obterConsulta(@Param('slug') slug: string) {
    const c = await this.publicadas.porSlug(slug);
    if (!c) throw new NotFoundException('Consulta não encontrada.');
    return new ApiEnvelope(c);
  }

  @Post('consultas/analisar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Testa o SELECT com limite 1 e devolve os binds e as colunas — é daqui que sai o contrato',
  })
  async analisar(@Body() dto: AnalisarConsultaDto) {
    return new ApiEnvelope(
      await this.publicadas.analisar(dto.conexao, dto.sql, dto.exemplos ?? {}),
    );
  }

  @Post('consultas')
  @ApiOperation({
    summary: 'Cria ou atualiza uma consulta da tela (e a publica, se pedido)',
  })
  async salvarConsulta(@Body() dto: SalvarConsultaPublicadaDto) {
    const slug = await this.publicadas.salvar(dto);
    return new ApiEnvelope(
      { slug },
      dto.publicada
        ? 'Consulta salva e publicada no catálogo da API.'
        : 'Consulta salva (não publicada).',
    );
  }

  @Delete('consultas/:slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma consulta criada pela tela' })
  async excluirConsulta(@Param('slug') slug: string) {
    const ok = await this.publicadas.excluir(slug);
    if (!ok) throw new NotFoundException('Consulta não encontrada.');
  }

  @Get('clientes')
  @ApiOperation({ summary: 'Clientes de máquina cadastrados' })
  async listar() {
    return new ApiEnvelope(await this.clientes.listar());
  }

  @Get('clientes/consultas-disponiveis')
  @ApiOperation({
    summary: 'Nomes de consulta que um token pode autorizar (o catálogo)',
  })
  async consultasDisponiveis() {
    return new ApiEnvelope(await this.clientes.consultasDisponiveis());
  }

  @Post('clientes')
  @ApiOperation({
    summary: 'Cadastra um cliente e devolve a chave (única exibição)',
  })
  async criar(@Body() dto: CriarClienteApiDto) {
    const criado = await this.clientes.criar(dto);
    return new ApiEnvelope(
      criado,
      'Cliente criado. Guarde a chave agora — ela não é exibida de novo.',
    );
  }

  @Patch('clientes/:id')
  @ApiOperation({ summary: 'Altera nome, consultas autorizadas ou observação' })
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarClienteApiDto,
  ) {
    return new ApiEnvelope(await this.clientes.atualizar(id, dto));
  }

  @Patch('clientes/:id/ativo')
  @ApiOperation({ summary: 'Revoga (false) ou reativa (true) o acesso' })
  async definirAtivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirAtivoDto,
  ) {
    return new ApiEnvelope(await this.clientes.definirAtivo(id, dto.ativo));
  }

  @Post('clientes/:id/rotacionar')
  @ApiOperation({ summary: 'Gera uma chave nova; a anterior deixa de valer' })
  async rotacionar(@Param('id', ParseIntPipe) id: number) {
    const c = await this.clientes.rotacionar(id);
    return new ApiEnvelope(
      c,
      'Chave rotacionada. A anterior já não vale — atualize o consumidor.',
    );
  }

  @Delete('clientes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Apaga o cadastro (prefira revogar, que preserva o histórico)',
  })
  async remover(@Param('id', ParseIntPipe) id: number) {
    await this.clientes.remover(id);
  }

  @Get('metricas')
  @ApiOperation({ summary: 'Uso por consulta desde o último boot' })
  metricas() {
    return new ApiEnvelope(this.dados.listarMetricas());
  }

  @Post('cache/limpar')
  @ApiOperation({
    summary: 'Descarta o cache de resultados (use após editar um SQL salvo)',
  })
  limparCache() {
    const n = this.dados.limparCache();
    return new ApiEnvelope({ descartadas: n }, `${n} entrada(s) de cache.`);
  }
}
