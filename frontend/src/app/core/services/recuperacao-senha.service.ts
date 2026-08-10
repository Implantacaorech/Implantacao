import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';

/** "Esqueci minha senha" da tela de login: pede um código de 6 dígitos por e-mail e, com
 * ele, grava a senha nova. Fora do `AuthService` porque nada aqui abre sessão — ao final o
 * usuário volta para o login e entra normalmente. */
@Injectable({ providedIn: 'root' })
export class RecuperacaoSenhaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth`;

  /** O backend responde igual para e-mail cadastrado e desconhecido (não revela quem tem
   * acesso ao Painel) — por isso a tela sempre avança para a etapa do código. */
  async solicitar(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiEnvelope<{ email: string }>>(`${this.base}/esqueci-senha`, { email }),
    );
  }

  async redefinir(email: string, codigo: string, senhaNova: string): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiEnvelope<null>>(`${this.base}/redefinir-senha`, {
        email,
        codigo,
        senhaNova,
      }),
    );
  }
}
