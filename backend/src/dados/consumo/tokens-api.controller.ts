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
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PERFIS_SISTEMA } from '../../common/constants/perfis';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiEnvelope } from '../../common/dto/api-envelope';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CatalogoService } from '../catalogo/catalogo.service';
import { DadosRemotoService } from './dados-remoto.service';
import {
  DefinirAtivoTokenDto,
  SalvarTokenApiDto,
  SondarTokenApiDto,
} from './dto/token-api.dto';
import { TokenApiDadosService } from './token-api-dados.service';

/** Sistema → **Tokens da API de Dados** (só ADM).
 *
 * É a tela do lado CONSUMIDOR: onde se cola o token gerado no Portal API para que o Painel
 * passe a consultar por ele, em vez de abrir conexão com o banco. O oposto de
 * `/dados/v1/admin/clientes`, que é onde o token NASCE.
 *
 * Vive só no Portal Implantação: o `DadosConsumoModule` não é montado pelo Portal API, que
 * é a ponta que executa e não a que consome. */
@ApiTags('tokens-api-dados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('dados/v1/tokens')
export class TokensApiController {
  constructor(
    private readonly tokens: TokenApiDadosService,
    private readonly remoto: DadosRemotoService,
    private readonly catalogo: CatalogoService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Tokens cadastrados (nunca a chave — só o prefixo)',
  })
  async listar() {
    const itens = await this.tokens.listar();
    const cobertas = new Set(
      itens.filter((t) => t.ativo).flatMap((t) => t.consultas),
    );
    // "O que ainda NÃO tem token" é a pergunta que a tela precisa responder: sem isso, uma
    // consulta descoberta só quando a tela dela fica vazia.
    const descobertas = (await this.catalogo.nomes()).filter(
      (n) => !cobertas.has(n),
    );
    return new ApiEnvelope({
      itens,
      descobertas,
      consumoRemotoAtivo: await this.remoto.ativo(),
    });
  }

  @Post('sondar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Testa o token no Portal API e devolve as consultas que ele autoriza',
  })
  async sondar(@Body() dto: SondarTokenApiDto) {
    return new ApiEnvelope(await this.remoto.sondar(dto.url, dto.chave));
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um token' })
  async criar(@Body() dto: SalvarTokenApiDto) {
    const t = await this.tokens.criar(dto);
    this.remoto.invalidar();
    return new ApiEnvelope(t, 'Token cadastrado.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza (chave em branco mantém a atual)' })
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarTokenApiDto,
  ) {
    const t = await this.tokens.atualizar(id, dto);
    this.remoto.invalidar();
    return new ApiEnvelope(t);
  }

  @Patch(':id/ativo')
  @ApiOperation({ summary: 'Liga/desliga o token sem apagá-lo' })
  async definirAtivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirAtivoTokenDto,
  ) {
    const t = await this.tokens.definirAtivo(id, dto.ativo);
    this.remoto.invalidar();
    return new ApiEnvelope(t);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apaga o cadastro' })
  async remover(@Param('id', ParseIntPipe) id: number) {
    await this.tokens.remover(id);
    this.remoto.invalidar();
  }
}
