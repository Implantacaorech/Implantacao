import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { ResultadoSaude } from '../models/saude.model';

/** Saúde da INFRAESTRUTURA (backup, Guardião, docservice, banco, e-mail, transcrições).
 * Sob a mesma permissão do Centro de Monitoramento (`centro_operacional`). */
@Injectable({ providedIn: 'root' })
export class SaudeService {
  private readonly http = inject(HttpClient);

  async diagnostico(): Promise<ResultadoSaude> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoSaude>>(`${environment.apiUrl}/saude`),
    );
    return r.data;
  }
}
