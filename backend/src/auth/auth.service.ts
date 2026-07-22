import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async login(
    login: string,
    senha: string,
  ): Promise<TokenPair & { usuario: AuthUser }> {
    const usuario = await this.users.porLogin(login);
    if (!usuario) throw new UnauthorizedException('Login ou senha inválidos');
    const senhaOk = await this.users.validarSenha(usuario, senha);
    if (!senhaOk) throw new UnauthorizedException('Login ou senha inválidos');
    return this.emitirParaUsuario(usuario);
  }

  /** Emite um par de tokens para um `Usuario` já resolvido/autenticado por outro meio
   * (ex.: confirmação de auto-cadastro, que loga a pessoa na hora, igual
   * webapp/app.py:cadastro_confirmar faz via sessão). */
  async emitirParaUsuario(
    usuario: Usuario,
  ): Promise<TokenPair & { usuario: AuthUser }> {
    const payload: AuthUser = {
      sub: usuario.id,
      login: usuario.login,
      nome: usuario.nome,
      perfil: usuario.perfil,
      codigoSicla: usuario.codigoSicla,
    };
    const tokens = await this.emitirTokens(payload);
    return { ...tokens, usuario: payload };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: AuthUser;
    try {
      payload = await this.jwt.verifyAsync<AuthUser>(refreshToken, {
        secret: this.config.get('jwtRefreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
    const hash = this.hash(refreshToken);
    const registro = await this.refreshRepo.findOne({
      where: { tokenHash: hash, revogado: false },
    });
    if (!registro || registro.expiraEm < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
    // Rotaciona: revoga o antigo e emite um par novo — reduz a janela de replay.
    registro.revogado = true;
    await this.refreshRepo.save(registro);
    return this.emitirTokens({
      sub: payload.sub,
      login: payload.login,
      nome: payload.nome,
      perfil: payload.perfil,
      codigoSicla: payload.codigoSicla,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.hash(refreshToken);
    await this.refreshRepo.update({ tokenHash: hash }, { revogado: true });
  }

  private async emitirTokens(payload: AuthUser): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwtSecret', { infer: true }),
      expiresIn: this.config.get('jwtExpiresIn', { infer: true }),
    });
    // jti aleatório: sem isso, dois logins do mesmo usuário no mesmo segundo (mesmo iat/exp)
    // geram o token JWT byte-a-byte idêntico, e o hash único em refresh_tokens colide.
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomBytes(16).toString('hex') },
      {
        secret: this.config.get('jwtRefreshSecret', { infer: true }),
        expiresIn: this.config.get('jwtRefreshExpiresIn', { infer: true }),
      },
    );
    const dias = 7;
    await this.refreshRepo.save(
      this.refreshRepo.create({
        usuarioId: payload.sub,
        tokenHash: this.hash(refreshToken),
        expiraEm: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
        revogado: false,
      }),
    );
    return { accessToken, refreshToken };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Só para o seed inicial (primeiro boot sem usuários) — nunca reaproveitar em runtime normal. */
  static gerarSenhaTemporaria(): string {
    return randomBytes(9).toString('base64url');
  }
}
