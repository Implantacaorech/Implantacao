import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { StatusCredencialRechEdu } from '../models/rechedu.model';

/** Credencial pessoal do RechEdu — a tela Execução → RechEdu pede o login no 1º uso e o
 * backend guarda por usuário (irmã de `ProtocoloService.credencialPortal`). */
@Injectable({ providedIn: 'root' })
export class RecheduService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/rechedu`;

  /** Status da credencial do usuário logado (tem? qual login?). */
  async credencial(): Promise<StatusCredencialRechEdu> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<StatusCredencialRechEdu>>(
        `${this.base}/credencial`,
      ),
    );
    return r.data;
  }

  /** Senha em branco na edição mantém a atual (regra do backend). */
  async salvarCredencial(
    login: string,
    senha: string,
  ): Promise<StatusCredencialRechEdu> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<StatusCredencialRechEdu>>(
        `${this.base}/credencial`,
        { login, senha },
      ),
    );
    return r.data;
  }

  async removerCredencial(): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/credencial`));
  }
}
