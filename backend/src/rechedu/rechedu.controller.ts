import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { SalvarCredencialRecheduDto } from './dto/salvar-credencial-rechedu.dto';
import { RecheduCredencialService } from './rechedu-credencial.service';

/** RechEdu (/rechedu/*): credencial pessoal do portal de educação (www.rechedu.com.br),
 * irmã da credencial do Portal Rech em /protocolos/portal/credencial. A tela Execução →
 * RechEdu emoldura o site num iframe e pede o login no 1º uso. */
@ApiTags('rechedu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Permissao('rechedu')
@Controller('rechedu')
export class RecheduController {
  constructor(private readonly credencial: RecheduCredencialService) {}

  @Get('credencial')
  @ApiOperation({
    summary:
      'Se o usuário já salvou a credencial do RechEdu (só o login volta)',
  })
  credencialRechEdu(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope({
      tem: this.credencial.tem(user.sub),
      login: this.credencial.loginDe(user.sub),
    });
  }

  @Post('credencial')
  @HttpCode(HttpStatus.OK)
  // Herda o nível de CONSULTA da classe de propósito (sem o override de 'alteracao'): salvar
  // a PRÓPRIA credencial do RechEdu é configuração pessoal, não uma escrita em dados do
  // sistema — mesma decisão da credencial do Portal Rech (exceção M2 catalogada em
  // conformidade-permissoes-escrita.spec.ts).
  @ApiOperation({ summary: 'Salva a credencial do RechEdu do próprio usuário' })
  salvarCredencial(
    @Body() dto: SalvarCredencialRecheduDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.credencial.salvar(user.sub, dto.login, dto.senha ?? '');
    return new ApiEnvelope({
      tem: this.credencial.tem(user.sub),
      login: this.credencial.loginDe(user.sub),
    });
  }

  @Delete('credencial')
  @HttpCode(HttpStatus.OK)
  // Consulta (herda da classe): mexer na PRÓPRIA credencial é pessoal, não escrita de dados.
  @ApiOperation({
    summary: 'Remove a credencial do RechEdu do próprio usuário',
  })
  removerCredencial(@CurrentUser() user: AuthUser) {
    this.credencial.remover(user.sub);
    return new ApiEnvelope({ tem: false });
  }
}
