import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { AtualizarUsuarioPayload, CriarUsuarioPayload, Usuario } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/usuarios`;

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
}
