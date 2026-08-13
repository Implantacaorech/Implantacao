import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { AppConfig } from '../config/configuration';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwtSecret', { infer: true }),
    });
  }

  validate(payload: AuthUser & { escopo?: string }): AuthUser {
    // Achado A7 da auditoria de 2026-08-12: o ticket de mídia (emitido por videoTicket com
    // `escopo:'midia'` e o MESMO segredo do login) era um Bearer válido em qualquer rota
    // protegida só por JwtAuthGuard sem @Roles/@Permissao — e ainda viajava na URL (`?t=`).
    // O streaming de vídeo NÃO depende desta Strategy: ele valida o ticket por conta própria
    // em ProtocolosMidiaController.exigirTicket. Logo, rejeitar o ticket aqui fecha o desvio
    // sem quebrar o player. Um token de SESSÃO nunca carrega `escopo`.
    if (payload?.escopo) {
      throw new UnauthorizedException(
        'Token de escopo restrito não vale como sessão.',
      );
    }
    return payload;
  }
}
