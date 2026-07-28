import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';

export type NivelPermissao = 'nada' | 'consulta' | 'alteracao';

/** Espelho, no cliente, do painel de Permissões do backend. Carrega o mapa menu→nível do
 * usuário logado (`/permissoes/me`) e alimenta o menu e os guards do Angular. A regra de
 * verdade continua no backend — aqui é só UX (esconder o que não pode). */
@Injectable({ providedIn: 'root' })
export class PermissoesService {
  private readonly http = inject(HttpClient);

  readonly niveis = signal<Record<string, NivelPermissao>>({});
  private carregado = false;
  private emCurso: Promise<void> | null = null;

  /** Garante que o mapa foi carregado ao menos uma vez (usado pelos guards). */
  async garantirCarregado(): Promise<void> {
    if (this.carregado) return;
    if (!this.emCurso) this.emCurso = this.carregar();
    await this.emCurso;
  }

  async carregar(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiEnvelope<{ niveis: Record<string, NivelPermissao> }>>(
          `${environment.apiUrl}/permissoes/me`,
        ),
      );
      this.niveis.set(res.data.niveis ?? {});
      this.carregado = true;
    } catch {
      this.niveis.set({});
    } finally {
      this.emCurso = null;
    }
  }

  limpar(): void {
    this.niveis.set({});
    this.carregado = false;
  }

  nivel(menu: string): NivelPermissao {
    return this.niveis()[menu] ?? 'nada';
  }
  podeVer(menu: string): boolean {
    return this.nivel(menu) !== 'nada';
  }
  podeAlterar(menu: string): boolean {
    return this.nivel(menu) === 'alteracao';
  }

  /** Computed reutilizável para um menu (ex.: `ver = perm.verSig('matriz')`). */
  verSig(menu: string) {
    return computed(() => this.podeVer(menu));
  }
}
