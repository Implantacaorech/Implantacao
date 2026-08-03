import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/models/api-envelope.model';
import { NivelPermissao } from './permissoes.service';

export interface DefMenu {
  chave: string;
  rotulo: string;
  grupo: string;
  fixaAdm?: boolean;
}
export interface CelulaPapel {
  papel: string;
  menu: string;
  nivel: NivelPermissao;
}
export interface Excecao {
  usuarioId: number;
  menu: string;
  nivel: NivelPermissao;
}
export interface UsuarioLista {
  id: number;
  nome: string;
  login: string;
  perfil: string;
}
export interface MatrizPermissoes {
  menus: DefMenu[];
  papeis: string[];
  niveis: NivelPermissao[];
  porPapel: CelulaPapel[];
  porUsuario: Excecao[];
  usuarios: UsuarioLista[];
}

/** Acesso HTTP à MANUTENÇÃO de permissões (tela Gestão → Permissões, perfil ADM).
 *
 * Separado do `PermissoesService`, que responde "o usuário atual pode ver este menu?" e é
 * consumido pelo app inteiro. São responsabilidades diferentes (SRP): um lê o próprio
 * acesso em tempo de execução, o outro edita a matriz dos outros.
 *
 * Existe porque o componente falava com o `HttpClient` direto — a tela conhecia rota,
 * verbo e envelope da API. Aqui a tela pede "salve este nível" e não sabe como isso viaja. */
@Injectable({ providedIn: 'root' })
export class PermissoesAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/permissoes`;

  async matriz(): Promise<MatrizPermissoes> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<MatrizPermissoes>>(this.base),
    );
    return res.data;
  }

  async definirNivelDoPapel(
    papel: string,
    menu: string,
    nivel: NivelPermissao,
  ): Promise<void> {
    await firstValueFrom(
      this.http.put<ApiEnvelope<{ salvo: boolean }>>(`${this.base}/papel`, {
        papel,
        menu,
        nivel,
      }),
    );
  }

  /** Exceção por usuário. `'herdar'` remove a exceção e devolve o usuário à regra do papel
   * — é a mesma chamada, e por isso `removerExcecao` não existe como rota própria. */
  async definirExcecaoDoUsuario(
    usuarioId: number,
    menu: string,
    nivel: NivelPermissao | 'herdar',
  ): Promise<void> {
    await firstValueFrom(
      this.http.put<ApiEnvelope<{ salvo: boolean }>>(`${this.base}/usuario`, {
        usuarioId,
        menu,
        nivel,
      }),
    );
  }
}
