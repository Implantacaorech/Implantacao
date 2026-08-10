import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RecuperacaoSenhaService } from './recuperacao-senha.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly recuperacao: RecuperacaoSenhaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Login por usuário/senha — equivalente a POST /login do Painel Flask',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.login, dto.senha);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renova o access token a partir de um refresh token válido',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga o refresh token da sessão atual' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return new ApiEnvelope(null, 'Sessão encerrada');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Dados do usuário autenticado (perfil, código SICLA) — para o menu/guards do Angular',
  })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('trocar-senha')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Autoatendimento: o próprio usuário logado troca a senha, exige a senha atual (diferente de PUT /usuarios/:id, exclusivo do ADM)',
  })
  async trocarSenha(
    @CurrentUser() user: AuthUser,
    @Body() dto: TrocarSenhaDto,
  ) {
    await this.users.trocarSenha(user.sub, dto.senhaAtual, dto.senhaNova);
    return new ApiEnvelope(null, 'Senha alterada.');
  }

  @Post('esqueci-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '"Esqueci minha senha" da tela de login: envia um código de 6 dígitos ao e-mail da conta',
  })
  async esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    await this.recuperacao.solicitar(dto.email);
    // Resposta deliberadamente igual para e-mail cadastrado e desconhecido — sem login, este
    // endpoint viraria um verificador de quem tem acesso ao Painel (ver
    // RecuperacaoSenhaService).
    return new ApiEnvelope(
      { email: dto.email },
      'Se este e-mail tiver acesso ao Painel, o código chegará em instantes.',
    );
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Conclui o "Esqueci minha senha": valida o código e grava a senha nova (sem exigir a atual)',
  })
  async redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    const r = await this.recuperacao.redefinir(
      dto.email,
      dto.codigo,
      dto.senhaNova,
    );
    if (!r.ok) throw new BadRequestException(r.mensagem);
    return new ApiEnvelope(null, 'Senha redefinida. Entre com a senha nova.');
  }
}
