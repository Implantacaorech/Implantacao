import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { UsersService } from './users.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Usuario } from '../database/entities/usuario.entity';

// Nunca devolver o hash da senha pela API.
function semSenha(u: Usuario): Omit<Usuario, 'senhaHash'> {
  const { senhaHash: _senhaHash, ...resto } = u;
  return resto;
}

/** CRUD de Usuários (`/usuarios`) — exclusivo do Administrador. Espelha
 * webapp/app.py:usuarios, adaptado para REST (POST cria, PUT atualiza — o Flask original
 * usa um único formulário combinado create/edit; não há rota de exclusão lá nem aqui,
 * desativação é feita pelo campo `ativo`). */
@ApiTags('usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os usuários (ativos e inativos)' })
  async listar() {
    return new ApiEnvelope({
      itens: (await this.service.listar()).map(semSenha),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha de um usuário' })
  async buscar(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(semSenha(await this.service.buscarPorId(id)));
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo usuário' })
  async criar(@Body() dto: CreateUsuarioDto) {
    const usuario = await this.service.criar({
      login: dto.login ?? '',
      nome: dto.nome ?? '',
      email: dto.email,
      senha: dto.senha,
      perfil: dto.perfil ?? 'Consultor',
      perfis: dto.perfis,
      codigoSicla: dto.codigoSicla,
    });
    return new ApiEnvelope(semSenha(usuario));
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualiza um usuário (senha só muda se enviada)' })
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return new ApiEnvelope(semSenha(await this.service.atualizar(id, dto)));
  }
}
