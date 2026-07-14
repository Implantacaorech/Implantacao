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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PERFIS_DESIGNA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';

@ApiTags('projetos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza campos da ficha do projeto' })
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjetoDto,
  ) {
    return this.service.atualizar(id, dto);
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
