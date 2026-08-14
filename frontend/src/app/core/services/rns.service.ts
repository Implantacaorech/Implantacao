import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { ResultadoConsultaRns } from '../models/rns.model';

@Injectable({ providedIn: 'root' })
export class RnsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/rns`;

  /** RNS criadas na janela [ini, fim] (inclusiva). Sem parâmetros, o backend responde do
   * 1º dia do mês anterior ao último dia do mês seguinte. */
  async consultar(ini?: string, fim?: string): Promise<ResultadoConsultaRns> {
    let params = new HttpParams();
    if (ini) params = params.set('ini', ini);
    if (fim) params = params.set('fim', fim);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoConsultaRns>>(this.base, { params }),
    );
    // Blindagem contra bundle novo x backend antigo (mesmo idioma dos services de BI).
    const d = res.data;
    return { ...d, itens: d.itens ?? [] };
  }
}
