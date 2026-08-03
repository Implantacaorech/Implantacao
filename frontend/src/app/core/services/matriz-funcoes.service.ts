import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';

export interface FuncaoComNota {
  codigo: string;
  descricao: string;
  menus: string;
  chave: string;
  nota: number | null;
}
export interface ModuloComNotasFuncoes {
  sigla: string;
  titulo: string;
  total: number;
  avaliadas: number;
  media: number | null;
  funcoes: FuncaoComNota[];
}
export interface FichaMatrizFuncoes {
  tecnico: { id: number; nome: string; setor: string; dias: string };
  modulos: ModuloComNotasFuncoes[];
  resumo: { media: number | null; avaliadas: number; total: number };
  editavel: boolean;
  volta: boolean;
}
export interface ListaMatrizFuncoes {
  tecnicos: { id: number; nome: string; setor: string }[];
  meuId: number | null;
  podeVerTodos: boolean;
  podeAdmin: boolean;
}

/** Acesso HTTP à Matriz de Conhecimento por FUNÇÃO SICLA.
 *
 * Irmão do `MatrizDetalhadaService` — mesma forma, outro recurso. O `HttpErrorResponse`
 * continua sendo tratado no componente de propósito: traduzir erro em mensagem para o
 * usuário é apresentação, não integração. */
@Injectable({ providedIn: 'root' })
export class MatrizFuncoesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/matriz-funcoes`;

  async lista(): Promise<ListaMatrizFuncoes> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ListaMatrizFuncoes>>(this.base),
    );
    return res.data;
  }

  async ficha(tecnicoId: number): Promise<FichaMatrizFuncoes> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<FichaMatrizFuncoes>>(
        `${this.base}/${tecnicoId}`,
      ),
    );
    return res.data;
  }

  /** Relê a LISTA_FUNCOES no SICLA descartando o cache do servidor. */
  async recarregarDoSicla(): Promise<{ modulos: number; funcoes: number }> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ modulos: number; funcoes: number }>>(
        `${this.base}/recarregar`,
        {},
      ),
    );
    return res.data;
  }

  async salvarNotas(
    tecnicoId: number,
    notas: Record<string, string>,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiEnvelope<{ salvo: boolean }>>(
        `${this.base}/${tecnicoId}/salvar`,
        { notas },
      ),
    );
  }
}
