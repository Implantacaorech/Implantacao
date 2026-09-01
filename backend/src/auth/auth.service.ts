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
import { ContatosSiclaService } from '../contatos-sicla/contatos-sicla.service';

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
    private readonly contatos: ContatosSiclaService,
  ) {}

  async login(
    login: string,
    senha: string,
  ): Promise<TokenPair & { usuario: AuthUser }> {
    const usuario = await this.users.porLogin(login);
    if (!usuario) throw new UnauthorizedException('Login ou senha inválidos');
    const senhaOk = await this.users.validarSenha(usuario, senha);
    if (!senhaOk) throw new UnauthorizedException('Login ou senha inválidos');
    await this.exigirContatoLiberadoNoSicla(usuario);
    return this.emitirParaUsuario(usuario);
  }

  /** Revalida o usuário-cliente contra o SICLA a cada entrada (decisão do usuário em
   * 2026-08-31: "o SICLA manda" — docs/acesso-cliente-bi.md §10).
   *
   * Quem autoriza um contato a usar o portal é `LISTA_CONTATOS.PORTAL_RECH_CLIENTES = 1`. Se
   * a Rech tirar essa marcação, o acesso ao Painel tem de cair junto — sem depender de
   * alguém lembrar de revogar na tela. É o que evita o acesso do cliente sobreviver ao fim
   * do projeto, que era o furo conhecido do fluxo manual.
   *
   * **Fail-closed quando a conexão existe e falha** (`indisponivel`), e isso é deliberado:
   * deixar entrar sem conseguir conferir seria abrir a porta justamente quando não se sabe
   * quem está do outro lado. Não tira nada de ninguém — o BI do cliente lê o SICLA, então
   * sem ele a tela viria vazia de qualquer forma.
   *
   * **Aberto quando não há integração** (`sem-integracao`): instância que não fala com o
   * SICLA é dev ou teste, não produção. Ali não há dado de cliente para proteger, e recusar
   * tornaria o acesso do cliente impossível de exercitar fora de produção.
   *
   * Só afeta papel `Cliente`: usuário interno entra normalmente com o Oracle fora do ar. */
  private async exigirContatoLiberadoNoSicla(usuario: Usuario): Promise<void> {
    if (!papeisDoUsuario(usuario).includes('Cliente')) return;
    const situacao = await this.contatos.situacaoNoSicla(
      usuario.email || usuario.login,
    );
    if (situacao === 'liberado' || situacao === 'sem-integracao') return;
    throw new UnauthorizedException(
      situacao === 'indisponivel'
        ? 'Não foi possível confirmar seu acesso agora. Tente novamente em alguns minutos.'
        : 'Seu acesso ao portal não está mais liberado. Procure seu contato na Rech.',
    );
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
