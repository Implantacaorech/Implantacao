import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PerfilInstancia = 'painel' | 'portal-api';

export interface Instancia {
  perfil: PerfilInstancia;
  nome: string;
  descricao: string;
  rotaInicial: string;
}

/** Padrão até o backend responder: o sistema COMPLETO. Errar para o lado do Painel é bem
 * mais visível — e menos danoso — do que esconder o menu de todo mundo. */
const PADRAO: Instancia = {
  perfil: 'painel',
  nome: 'Painel de Implantação',
  descricao: '',
  rotaInicial: '/home',
};

/** QUAL DAS DUAS INSTÂNCIAS este front-end está servindo (ver `docs/portal-conexoes.md`).
 *
 * O mesmo build do Angular é servido pelo Painel (5100) e pelo **Portal API** (5110). O
 * segundo monta só a API de Dados: oferecer ali o menu inteiro seria oferecer portas que
 * não abrem, porque os módulos por trás delas não existem naquele processo.
 *
 * A pergunta é feita UMA vez por sessão de página, e **antes do login** — a tela de entrada
 * já pertence a uma das duas instâncias. */
@Injectable({ providedIn: 'root' })
export class InstanciaService {
  private readonly http = inject(HttpClient);
  private pedido: Promise<Instancia> | null = null;

  readonly atual = signal<Instancia>(PADRAO);
  readonly portalApi = computed(() => this.atual().perfil === 'portal-api');

  /** Idempotente: chamadas simultâneas compartilham a mesma requisição. */
  async garantirCarregado(): Promise<Instancia> {
    this.pedido ??= this.buscar();
    return this.pedido;
  }

  private async buscar(): Promise<Instancia> {
    try {
      const r = await firstValueFrom(
        this.http.get<Instancia>(`${environment.apiUrl}/instancia`),
      );
      // Perfil desconhecido (backend mais novo que este build) cai no padrão, em vez de
      // deixar o menu num estado que ninguém previu.
      const perfil: PerfilInstancia =
        r?.perfil === 'portal-api' ? 'portal-api' : 'painel';
      const instancia = { ...PADRAO, ...r, perfil };
      this.atual.set(instancia);
      return instancia;
    } catch {
      this.atual.set(PADRAO);
      return PADRAO;
    }
  }
}
