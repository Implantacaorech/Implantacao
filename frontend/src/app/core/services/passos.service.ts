import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  PapelProjeto,
  Passo,
  PessoaProjeto,
  PessoasProjeto,
  Rns,
  TipoRns,
} from '../models/passo.model';

/** Os 18 passos do processo, as pessoas por papel e as RNS do projeto. */
@Injectable({ providedIn: 'root' })
export class PassosService {
  private readonly http = inject(HttpClient);
  private readonly base = (projetoId: number) =>
    `${environment.apiUrl}/projetos/${projetoId}`;

  async listar(projetoId: number): Promise<Passo[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Passo[]>>(`${this.base(projetoId)}/passos`),
    );
    return res.data;
  }

  async concluir(projetoId: number, numero: number, observacao = ''): Promise<Passo[]> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Passo[]>>(
        `${this.base(projetoId)}/passos/${numero}/concluir`,
        { observacao },
      ),
    );
    return res.data;
  }

  async conferir(projetoId: number, numero: number): Promise<Passo[]> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Passo[]>>(
        `${this.base(projetoId)}/passos/${numero}/conferir`,
        {},
      ),
    );
    return res.data;
  }

  async reabrir(projetoId: number, numero: number): Promise<Passo[]> {
    const res = await firstValueFrom(
      this.http.delete<ApiEnvelope<Passo[]>>(
        `${this.base(projetoId)}/passos/${numero}`,
      ),
    );
    return res.data;
  }

  /** Anexa o e-mail encaminhado do Outlook (.msg/.eml) como registro dos passos 3 e 4. */
  async anexarEmail(
    projetoId: number,
    numero: number,
    arquivo: File,
  ): Promise<void> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    await firstValueFrom(
      this.http.post<ApiEnvelope<unknown>>(
        `${this.base(projetoId)}/passos/${numero}/anexar-email`,
        form,
      ),
    );
  }

  async pessoas(projetoId: number): Promise<PessoasProjeto> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<PessoasProjeto>>(`${this.base(projetoId)}/pessoas`),
    );
    return res.data;
  }

  async definirPessoas(
    projetoId: number,
    papel: PapelProjeto,
    pessoas: string[],
  ): Promise<PessoaProjeto[]> {
    const res = await firstValueFrom(
      this.http.patch<ApiEnvelope<PessoaProjeto[]>>(
        `${this.base(projetoId)}/pessoas`,
        { papel, pessoas },
      ),
    );
    return res.data;
  }

  async listarRns(projetoId: number): Promise<Rns[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Rns[]>>(`${this.base(projetoId)}/rns`),
    );
    return res.data;
  }

  async criarRns(
    projetoId: number,
    dados: { tipo: TipoRns; numero?: string; descricao?: string; situacao?: string },
  ): Promise<Rns> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Rns>>(`${this.base(projetoId)}/rns`, dados),
    );
    return res.data;
  }

  async removerRns(projetoId: number, rnsId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete<ApiEnvelope<{ ok: boolean }>>(
        `${this.base(projetoId)}/rns/${rnsId}`,
      ),
    );
  }
}
