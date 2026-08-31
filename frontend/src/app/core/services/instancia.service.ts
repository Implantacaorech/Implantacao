import { Injectable, computed, signal } from '@angular/core';

export type PerfilInstancia = 'painel' | 'portal-api';

export interface Instancia {
  perfil: PerfilInstancia;
  nome: string;
  descricao: string;
  rotaInicial: string;
}

/** Padrão até o backend responder: o sistema COMPLETO. Errar para o lado do Painel é bem
 * mais visível — e menos danoso — do que esconder o menu de todo mundo. */
export const INSTANCIA_PADRAO: Instancia = {
  perfil: 'painel',
  nome: 'Painel de Implantação',
  descricao: '',
  rotaInicial: '/home',
};

/** Lê `GET /api/instancia` **antes** de o Angular subir (ver `src/main.ts`).
 *
 * É `fetch` e não `HttpClient` de propósito: acontece fora da aplicação, antes de haver
 * injetor. A resposta vem no envelope padrão do projeto (`{success, data, …}`) — ler `data`
 * é obrigatório, e foi exatamente o que faltou na primeira versão disto: o serviço lia
 * `perfil` da raiz, recebia `undefined` e caía no padrão, então o Portal API servia o menu
 * inteiro do Painel. */
export async function carregarInstancia(base = '/api'): Promise<Instancia> {
  try {
    const res = await fetch(`${base}/instancia`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return INSTANCIA_PADRAO;
    const corpo: unknown = await res.json();
    const dados = (corpo as { data?: Partial<Instancia> })?.data ?? corpo;
    const bruto = dados as Partial<Instancia>;
    // Perfil desconhecido (backend mais novo que este build) cai no padrão, em vez de
    // deixar o roteador num estado que ninguém previu.
    const perfil: PerfilInstancia =
      bruto?.perfil === 'portal-api' ? 'portal-api' : 'painel';
    return { ...INSTANCIA_PADRAO, ...bruto, perfil };
  } catch {
    return INSTANCIA_PADRAO;
  }
}

/** QUAL DAS DUAS INSTÂNCIAS este front-end está servindo (ver `docs/portal-conexoes.md`).
 *
 * O mesmo build do Angular é servido pelo Painel (5100) e pelo **Portal API** (5110). O
 * segundo monta só a API de Dados — e, desde 2026-08-26, **nem as rotas** dos demais
 * módulos existem lá: a tabela do roteador é escolhida no boot (`app.config.ts`), não
 * filtrada depois. Esconder o item de menu não bastava; o usuário pediu que o portal não
 * *tivesse* o resto.
 *
 * O valor chega resolvido, do `main.ts` — por isso aqui não há HTTP nem espera. */
@Injectable({ providedIn: 'root' })
export class InstanciaService {
  readonly atual = signal<Instancia>(INSTANCIA_PADRAO);
  readonly portalApi = computed(() => this.atual().perfil === 'portal-api');

  definir(instancia: Instancia): void {
    this.atual.set(instancia);
  }
}
