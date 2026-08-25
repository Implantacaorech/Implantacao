import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { DadosService } from './dados.service';
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
  ) {}

  @Get('clientes')
  @ApiOperation({ summary: 'Clientes de máquina cadastrados' })
  async listar() {
    return new ApiEnvelope(await this.clientes.listar());
  }

  @Get('clientes/escopos')
  @ApiOperation({ summary: 'Escopos que o catálogo reconhece' })
  escopos() {
    return new ApiEnvelope(this.clientes.escopos());
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
  @ApiOperation({ summary: 'Altera nome, escopos ou observação' })
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
