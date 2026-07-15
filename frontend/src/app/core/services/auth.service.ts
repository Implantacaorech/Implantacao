import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { AuthUser, LoginResponse } from '../models/auth-user.model';

const CHAVE_ACCESS = 'painel.accessToken';
const CHAVE_REFRESH = 'painel.refreshToken';
const CHAVE_USUARIO = 'painel.usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly usuario = signal<AuthUser | null>(this.lerUsuarioSalvo());
  readonly autenticado = computed(() => this.usuario() !== null);

  private lerUsuarioSalvo(): AuthUser | null {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    return bruto ? (JSON.parse(bruto) as AuthUser) : null;
  }

  get accessToken(): string | null {
    return localStorage.getItem(CHAVE_ACCESS);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(CHAVE_REFRESH);
  }

  async login(login: string, senha: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<LoginResponse>>(`${environment.apiUrl}/auth/login`, { login, senha }),
    );
    this.salvarSessao(res.data);
  }

  /** Abre sessão a partir de tokens já emitidos (ex.: login imediato após confirmar o auto-cadastro). */
  entrarComSessao(dados: LoginResponse): void {
    this.salvarSessao(dados);
  }

  async renovarToken(): Promise<string> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) throw new Error('Sem refresh token');
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(
        `${environment.apiUrl}/auth/refresh`,
        { refreshToken },
      ),
    );
    localStorage.setItem(CHAVE_ACCESS, res.data.accessToken);
    localStorage.setItem(CHAVE_REFRESH, res.data.refreshToken);
    return res.data.accessToken;
  }

  async logout(): Promise<void> {
    const refreshToken = this.refreshToken;
    try {
      if (refreshToken) {
        await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken }));
      }
    } finally {
      this.limparSessao();
      await this.router.navigateByUrl('/login');
    }
  }

  private salvarSessao(dados: LoginResponse): void {
    localStorage.setItem(CHAVE_ACCESS, dados.accessToken);
    localStorage.setItem(CHAVE_REFRESH, dados.refreshToken);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(dados.usuario));
    this.usuario.set(dados.usuario);
  }

  limparSessao(): void {
    localStorage.removeItem(CHAVE_ACCESS);
    localStorage.removeItem(CHAVE_REFRESH);
    localStorage.removeItem(CHAVE_USUARIO);
    this.usuario.set(null);
  }
}
