import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';

/** Um cliente devolvido pela busca no SICLA, já normalizado para a ficha. `bruto` traz a
 * linha original (todas as colunas), caso a tela precise de algo fora do mapeamento. */
export interface ClienteSicla {
  codigo: string;
  cliente: string;
  fantasia: string;
  cnpj: string;
  ramo: string;
  responsavel: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTel: string;
  bruto: Record<string, unknown>;
}

export interface ResultadoBuscaCliente {
  ok: boolean;
  mensagem: string;
  clientes: ClienteSicla[];
}

export interface CadastrarClientePayload {
  cliente: string;
  cnpj?: string;
  numeroProjeto?: string;
  numeroProposta?: string;
  ramo?: string;
  responsavel?: string;
  contatoNome?: string;
  contatoEmail?: string;
  contatoTel?: string;
  comercialEmail?: string;
  horasCobradas?: string;
  horasBonificadas?: string;
  modulos?: string;
  observacoes?: string;
}

export interface ResultadoCadastroCliente {
  projetoId: number;
  duplicado: boolean;
}

/** Passo 1 do processo: consulta do cliente no SICLA e cadastro da ficha. */
@Injectable({ providedIn: 'root' })
export class ClientesSiclaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/clientes-sicla`;

  async buscar(termo: string): Promise<ResultadoBuscaCliente> {
    const params = new HttpParams().set('termo', termo);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoBuscaCliente>>(`${this.base}/buscar`, {
        params,
      }),
    );
    return res.data;
  }

  async cadastrar(
    payload: CadastrarClientePayload,
  ): Promise<ResultadoCadastroCliente> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoCadastroCliente>>(this.base, payload),
    );
    return res.data;
  }
}
