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
import { papeisDoUsuario } from '../users/papeis.util';

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
      perfis: papeisDoUsuario(usuario),
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
    // Busca SEM o filtro `revogado: false` — um token já revogado apresentado de novo é o
    // sinal que interessa para a detecção de reuso (M11).
    const registro = await this.refreshRepo.findOne({
      where: { tokenHash: hash },
    });
    if (!registro || registro.expiraEm < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
    if (registro.revogado) {
      // M11 — reuso de um refresh que já tinha sido ROTACIONADO (usado) é sinal de token
      // vazado: o dono usou, rotacionou, e agora ele aparece de novo. Revoga TODA a família
      // ativa do usuário — atacante e legítimo reautenticam. Um token de LOGOUT reapresentado
      // (aba velha) não escala: é 401 e pronto, para não derrubar os outros dispositivos.
      if (registro.motivoRevogacao === 'rotacao') {
        await this.refreshRepo.update(
          { usuarioId: registro.usuarioId, revogado: false },
          { revogado: true, motivoRevogacao: 'replay' },
        );
      }
      throw new UnauthorizedException(
        'Sessão encerrada por segurança (token reutilizado). Entre novamente.',
      );
    }
    // Rotaciona: revoga o antigo (motivo `rotacao`) e emite um par novo — reduz a janela de
    // replay e marca o token para a detecção de reuso acima.
    registro.revogado = true;
    registro.motivoRevogacao = 'rotacao';
    await this.refreshRepo.save(registro);

    // Papéis, nome e código SICLA saem do CADASTRO, não do token que veio. Enquanto eram
    // recopiados do payload, uma mudança feita em Gestão → Usuários nunca alcançava quem já
    // estava logado: a pessoa ganhava o papel de Levantador, o token continuava sem ele e o
    // Painel dizia "só o responsável (Levantador) pode concluir" — só saindo e entrando de
    // novo resolvia (diagnóstico de 2026-07-29). O `nome` importa pelo mesmo motivo: é por
    // ele que se confere a designação da pessoa no projeto.
    // `buscarPorId` lança 404 quando o cadastro sumiu; aqui a resposta certa é 401 — quem
    // renova token não devia saber se o id existe.
    const usuario = await this.users.buscarPorId(payload.sub).catch(() => null);
    if (!usuario?.ativo) {
      throw new UnauthorizedException('Usuário inativo ou removido.');
    }
    return this.emitirTokens({
      sub: usuario.id,
      login: usuario.login,
      nome: usuario.nome,
      perfil: usuario.perfil,
      perfis: papeisDoUsuario(usuario),
      codigoSicla: usuario.codigoSicla,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.hash(refreshToken);
    // motivo `logout`: reapresentar este token depois NÃO escala para revogar a família
    // (só o reuso de um token `rotacao` faz isso — ver refresh/M11).
    await this.refreshRepo.update(
      { tokenHash: hash },
      { revogado: true, motivoRevogacao: 'logout' },
    );
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
}
