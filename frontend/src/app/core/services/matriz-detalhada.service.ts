import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';

export interface MenuComNota {
  codigo: string;
  opcao: string;
  programa: string;
  funcao: string;
  chave: string;
  nota: number | null;
}
export interface ModuloComNotas {
  sigla: string;
  tipo: 'modulo' | 'adicional';
  titulo: string;
  total: number;
  avaliadas: number;
  media: number | null;
  menus: MenuComNota[];
}
export interface FichaMatrizDetalhada {
  tecnico: { id: number; nome: string; setor: string; dias: string };
  modulos: ModuloComNotas[];
  resumo: { media: number | null; avaliadas: number; total: number };
  editavel: boolean;
  volta: boolean;
}
export interface ListaMatrizDetalhada {
  tecnicos: { id: number; nome: string; setor: string }[];
  meuId: number | null;
  podeVerTodos: boolean;
  podeAdmin: boolean;
}

/** Acesso HTTP à Matriz de Conhecimento DETALHADA (notas por menu do SIGER).
 *
 * A tela conhecia rota, verbo e envelope da API — acoplamento que o Guia Mestre põe no
 * service (ver `vault/23 - Padrões/`). Aqui o componente pede "carregue a ficha" e não sabe
 * como isso viaja. */
@Injectable({ providedIn: 'root' })
export class MatrizDetalhadaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/matriz-detalhada`;

  async lista(): Promise<ListaMatrizDetalhada> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ListaMatrizDetalhada>>(this.base),
    );
    return res.data;
  }

  async ficha(tecnicoId: number): Promise<FichaMatrizDetalhada> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<FichaMatrizDetalhada>>(
        `${this.base}/${tecnicoId}`,
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
