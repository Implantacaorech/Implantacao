import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ConsultorSigerService } from './consultor-siger.service';
import {
  FeedbackConsultorSigerDto,
  PesquisarConsultorSigerDto,
} from './dto/pesquisar-consultor-siger.dto';

/** Tela **Execução → Consultor SIGER** — base inteligente de conhecimento do código-fonte
 * do SIGER para os Consultores de Implantação. Gate pelo menu `consultor_siger`: tudo aqui
 * é consulta à base DERIVADA (a fonte `F:\SIGER` é somente leitura e nem é acessada pelo
 * Painel); o nível `consulta` (default do decorator) basta, inclusive para o feedback —
 * avaliar uma resposta faz parte de usar a tela, não de administrá-la. */
@ApiTags('consultor-siger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('consultor_siger')
@Controller('consultor-siger')
export class ConsultorSigerController {
  constructor(private readonly servico: ConsultorSigerService) {}

  @Get('status')
  @ApiOperation({
    summary:
      'Estado da base derivada (disponibilidade, contagens, última geração)',
  })
  status() {
    return new ApiEnvelope(this.servico.status());
  }

  @Get('pesquisa')
  @ApiOperation({
    summary:
      'Pergunta em linguagem natural → resposta estruturada com evidências (arquivo:linha) e confiança',
  })
  pesquisar(@Query() query: PesquisarConsultorSigerDto) {
    return new ApiEnvelope(
      this.servico.pesquisar(query.q, query.visao ?? 'funcional'),
    );
  }

  @Post('feedback')
  @ApiOperation({
    summary:
      'Avaliação da resposta (👍/👎 + observação) — registrada fora da fonte',
  })
  feedback(
    @Body() dto: FeedbackConsultorSigerDto,
    @Req() req: { user?: { email?: string } },
  ) {
    return new ApiEnvelope(
      this.servico.registrarFeedback(
        dto.pergunta,
        dto.util,
        dto.observacao,
        req.user?.email,
      ),
    );
  }
}
