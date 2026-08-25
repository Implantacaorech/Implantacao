import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { VERSAO_CONTRATO } from './catalogo/catalogo';
import { ConexoesService } from './conexoes/conexoes.service';
import { Chamador, ConsultasDoChamador } from './decorators/chamador.decorator';
import { DadosService } from './dados.service';
// `import type` obrigatório: o tipo aparece na assinatura de um método DECORADO e o
// emitDecoratorMetadata + isolatedModules exigem que ele não vire import de valor.
import type { IdentidadeChamador } from './dados.service';
import { ExecutarConsultaDto } from './dto/executar-consulta.dto';
import { AcessoDadosGuard } from './guards/acesso-dados.guard';

/** API DE DADOS — a única porta de entrada aos bancos externos vinculados ao Painel
 * (Oracle do SICLA, MySQL do Portal Rech).
 *
 * O consumidor chama uma consulta PELO NOME e manda parâmetros tipados; o SQL, a conexão e
 * o teto de linhas são do servidor. Não existe endpoint que aceite SQL — a tela Sistema →
 * Consultas BD continua sendo o lugar de editar o texto de uma consulta salva, e é
 * restrita ao Administrador.
 *
 * Autenticação: JWT do Painel (pessoa, gateada por menu) ou `X-API-Key` (cliente de
 * máquina, gateado pela lista de consultas do token). Ver `src/dados/docs/api.md`. */
@ApiTags('dados')
@ApiBearerAuth()
@ApiSecurity('api-key')
@UseGuards(AcessoDadosGuard)
@Controller('dados/v1')
export class DadosController {
  constructor(
    private readonly dados: DadosService,
    private readonly conexoes: ConexoesService,
  ) {}

  @Get('consultas')
  @ApiOperation({
    summary: 'Catálogo de consultas disponíveis (sem o SQL)',
  })
  async listar(@ConsultasDoChamador() autorizadas?: string[]) {
    const consultas = await this.dados.listar(autorizadas);
    return new ApiEnvelope(
      { versao: VERSAO_CONTRATO, total: consultas.length, consultas },
      `${consultas.length} consulta(s) no catálogo ${VERSAO_CONTRATO}.`,
    );
  }

  @Get('conexoes')
  @ApiOperation({
    summary: 'Bancos externos vinculados e se estão configurados/ativos',
  })
  conexoesDisponiveis() {
    return new ApiEnvelope(this.conexoes.estados());
  }

  @Get('consultas/:nome')
  @ApiOperation({ summary: 'Contrato de uma consulta (parâmetros, tetos)' })
  async descrever(@Param('nome') nome: string) {
    return new ApiEnvelope(await this.dados.descrever(nome));
  }

  @Post('consultas/:nome/executar')
  @ApiOperation({ summary: 'Executa uma consulta do catálogo' })
  async executar(
    @Param('nome') nome: string,
    @Body() corpo: ExecutarConsultaDto,
    @Chamador() quem: IdentidadeChamador,
  ) {
    const r = await this.dados.executar(
      nome,
      corpo.parametros,
      { pagina: corpo.pagina, tamanho: corpo.tamanho },
      quem,
    );
    return new ApiEnvelope(
      r,
      `${r.paginacao.retornadas} linha(s).`,
      r.paginacao,
    );
  }
}
