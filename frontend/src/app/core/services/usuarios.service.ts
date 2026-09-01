import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  AtualizarUsuarioPayload,
  CriarUsuarioPayload,
  ListaTecnicosSicla,
  ResultadoImportacaoTecnicos,
  Usuario,
} from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/usuarios`;
  private readonly baseTecnicos = `${environment.apiUrl}/tecnicos-sicla`;

  async listar(): Promise<Usuario[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<{ itens: Usuario[] }>>(this.base),
    );
    return res.data.itens;
  }

  async buscar(id: number): Promise<Usuario> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<Usuario>>(`${this.base}/${id}`));
    return res.data;
  }

  async criar(dto: CriarUsuarioPayload): Promise<Usuario> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<Usuario>>(this.base, dto));
    return res.data;
  }

  async atualizar(id: number, dto: AtualizarUsuarioPayload): Promise<Usuario> {
    const res = await firstValueFrom(this.http.put<ApiEnvelope<Usuario>>(`${this.base}/${id}`, dto));
    return res.data;
  }

  /** Exclusão DEFINITIVA (rota exclusiva do ADM). O backend recusa autoexclusão e usuário
   * com designação em projeto — nesses casos a resposta manda desativar. */
  async excluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<ApiEnvelope<null>>(`${this.base}/${id}`));
  }

  /** Técnicos do SICLA (LISTA_TECNICOS) — a fonte do cadastro de Usuários.
   * `somenteNovos` traz só quem ainda não tem cadastro no Painel. */
  async listarTecnicosSicla(termo = '', somenteNovos = false): Promise<ListaTecnicosSicla> {
    const params: Record<string, string> = {};
    if (termo) params['termo'] = termo;
    if (somenteNovos) params['novos'] = '1';
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ListaTecnicosSicla>>(this.baseTecnicos, { params }),
    );
    return res.data;
  }

  /** Importa técnicos do SICLA para Usuários. Sem `codigos`, importa a lista inteira. */
  async importarTecnicos(codigos?: string[]): Promise<ResultadoImportacaoTecnicos> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoImportacaoTecnicos>>(
        `${this.baseTecnicos}/importar`,
        { codigos },
      ),
    );
    return res.data;
  }
}
