import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { ResultadoEnvioEmailProjeto, TelaEmailProjeto } from '../models/projeto-email.model';

@Injectable({ providedIn: 'root' })
export class ProjetoEmailService {
  private readonly http = inject(HttpClient);

  private base(projetoId: number): string {
    return `${environment.apiUrl}/projetos/${projetoId}/email`;
  }

  async tela(projetoId: number): Promise<TelaEmailProjeto> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<TelaEmailProjeto>>(this.base(projetoId)));
    return r.data;
  }

  async enviar(projetoId: number, destino: string, assunto: string, corpo: string): Promise<ResultadoEnvioEmailProjeto> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoEnvioEmailProjeto>>(this.base(projetoId), { destino, assunto, corpo }),
    );
    return r.data;
  }
}
