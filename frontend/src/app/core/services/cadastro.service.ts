import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { LoginResponse } from '../models/auth-user.model';
import { ConfirmarCadastroPayload, IniciarCadastroPayload, ReenviarCadastroPayload } from '../models/cadastro.model';

@Injectable({ providedIn: 'root' })
export class CadastroService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cadastro`;

  async iniciar(dto: IniciarCadastroPayload): Promise<{ email: string }> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<{ email: string }>>(this.base, dto));
    return res.data;
  }

  async confirmar(dto: ConfirmarCadastroPayload): Promise<LoginResponse> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<LoginResponse>>(`${this.base}/confirmar`, dto),
    );
    return res.data;
  }

  async reenviar(dto: ReenviarCadastroPayload): Promise<{ email: string }> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ email: string }>>(`${this.base}/reenviar`, dto),
    );
    return res.data;
  }
}
