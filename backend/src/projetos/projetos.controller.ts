import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjetosService } from './projetos.service';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';
import { ListarProjetosDto } from './dto/listar-projetos.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PERFIS_DESIGNA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';

@ApiTags('projetos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Permissao('carteira')
@Controller('projetos')
export class ProjetosController {
  constructor(private readonly service: ProjetosService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista projetos, paginado, filtrado por perfil (equivalente a _so_meus)',
  })
  async listar(
    @Query() filtro: ListarProjetosDto,
    @CurrentUser() user: AuthUser,
  ) {
    const resultado = await this.service.listar(filtro, user);
    return new ApiEnvelope(resultado.data, undefined, resultado.pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha de um projeto' })
  buscar(@Param('id', ParseIntPipe) id: number) {
    return this.service.buscarPorId(id);
  }

  @Post()
  @Roles(...PERFIS_DESIGNA)
  @ApiOperation({ summary: 'Cria um projeto novo (Hub)' })
  criar(@Body() dto: CreateProjetoDto) {
    return this.service.criar(dto);
  }

  /** Edição da ficha.
   *
   * `@Permissao('carteira')` da classe é nível CONSULTA — sozinho, deixava quem só consulta
   * reescrever o projeto. Pior: `gci` e `consultor` são os campos que a RN-10 usa para saber
   * quem pode concluir os passos, então bastava alguém se escrever ali para destravar o
   * passo 10 de um cliente que não é seu (achado de 2026-08-05). Agora exige `alteracao`, e
   * quem MUDA a equipe é `PERFIS_DESIGNA` — verificado no serviço, porque depende de o
   * campo ter vindo no corpo. */
  @Put(':id')
  @Permissao('carteira', 'alteracao')
  @ApiOperation({ summary: 'Atualiza campos da ficha do projeto' })
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjetoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.atualizar(id, dto, user);
  }

  @Delete(':id')
  @Roles(...PERFIS_DESIGNA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exclui o projeto (e, na conversão completa, suas tabelas filhas)',
  })
  async excluir(@Param('id', ParseIntPipe) id: number) {
    await this.service.excluir(id);
    return new ApiEnvelope(null, 'Projeto excluído');
  }
}
