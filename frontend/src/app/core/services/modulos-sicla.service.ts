import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';

/** Um módulo/adicional devolvido pela busca no SICLA. `codigo`/`descricao` já são os valores
 * efetivos (adicional quando há, senão módulo); os campos de módulo/adicional ficam à parte
 * para o layout. */
export interface ModuloSicla {
  codModulo: string;
  descModulo: string;
  codAdicional: string;
  descAdicional: string;
  codigo: string;
  descricao: string;
  bruto: Record<string, unknown>;
}

export interface ResultadoBuscaModulo {
  ok: boolean;
  mensagem: string;
  modulos: ModuloSicla[];
}

/** Passo 1: consulta de módulos/adicionais no SICLA para marcar os contratados. */
@Injectable({ providedIn: 'root' })
export class ModulosSiclaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/modulos-sicla`;

  async buscar(termo: string): Promise<ResultadoBuscaModulo> {
    const params = new HttpParams().set('termo', termo);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoBuscaModulo>>(`${this.base}/buscar`, {
        params,
      }),
    );
    return res.data;
  }
}
