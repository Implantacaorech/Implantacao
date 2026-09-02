import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { PanoramaPresenca } from '../models/presenca.model';

/** De quanto em quanto tempo o navegador anuncia presença. **Contrato compartilhado com o
 * backend** (`presenca.constants.ts`): a janela lá é o dobro disto, para uma batida perdida
 * não derrubar ninguém da lista. */
const INTERVALO_MS = 45_000;

const CHAVE_SESSAO = 'painel.presenca.sessao';

/** Presença: anuncia em que tela este navegador está, e lê quem está online.
 *
 * A batida sai da SPA, e não de um interceptor de requisição, por duas razões: quem está
 * PARADO lendo uma tela não gera requisição nenhuma e sumiria da lista; e o endpoint de API
 * não identifica a TELA — várias telas chamam o mesmo. Só a SPA sabe onde a pessoa está. */
@Injectable({ providedIn: 'root' })
export class PresencaService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/presenca`;

  private temporizador: ReturnType<typeof setInterval> | null = null;
  private rotaAtual = '';
  private tituloAtual = '';
  private ligado = false;

  /** Quantos estão online — o selo do botão na tela de Usuários. */
  readonly online = signal(0);

  /** Identificador desta ABA. `sessionStorage` (e não `localStorage`) de propósito: cada aba
   * tem o seu e ele morre com ela, que é exatamente o ciclo de vida de uma sessão de uso.
   * Em `localStorage`, duas abas dividiriam o mesmo id e contariam como uma só. */
  private sessaoId(): string {
    let id = sessionStorage.getItem(CHAVE_SESSAO);
    if (!id) {
      id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(CHAVE_SESSAO, id);
    }
    return id;
  }

  /** Começa a anunciar presença. Chamado uma vez pelo shell — que só existe autenticado. */
  iniciar(): void {
    if (this.ligado) return;
    this.ligado = true;

    this.capturarRota();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.capturarRota();
        // Batida imediata na troca de tela: quem acompanha precisa ver o movimento na hora,
        // não daqui a 45 segundos.
        void this.bater();
      });

    // Voltar para a aba conta como atividade — sem isto, quem volta de outro programa
    // continuaria marcado como ocioso até a batida seguinte.
    document.addEventListener('visibilitychange', () => void this.bater());

    void this.bater();
    this.temporizador = setInterval(() => void this.bater(), INTERVALO_MS);
  }

  /** Encerra a sessão desta aba (logout). Sem isto ela sairia sozinha ao esfriar — só que a
   * lista mostraria a pessoa online por mais dois minutos depois de ela ter saído. */
  async encerrar(): Promise<void> {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.ligado = false;
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/sair`, { sessao: this.sessaoId() }),
      );
    } catch {
      // Falhou avisar? A sessão esfria e sai da lista sozinha. Não vale travar o logout.
    }
  }

  private capturarRota(): void {
    this.rotaAtual = this.router.url;
    let r = this.router.routerState.snapshot.root;
    while (r.firstChild) r = r.firstChild;
    this.tituloAtual = (r.data['titulo'] as string) ?? 'Painel de Implantação';
  }

  private async bater(): Promise<void> {
    if (!this.ligado) return;
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/ping`, {
          sessao: this.sessaoId(),
          rota: this.rotaAtual,
          titulo: this.tituloAtual,
          visivel: document.visibilityState === 'visible',
        }),
      );
    } catch {
      // Presença é acessória: rede oscilando não pode encher o console nem quebrar a tela.
      // A próxima batida tenta de novo.
    }
  }

  /** Panorama completo — a tela de acompanhamento (só Administrador). */
  async panorama(): Promise<PanoramaPresenca> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<PanoramaPresenca>>(this.base),
    );
    const d = res.data;
    return { ...d, usuarios: d.usuarios ?? [] };
  }

  /** Só o número, para o selo do botão. Atualiza o signal `online`. */
  async atualizarContagem(): Promise<number> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiEnvelope<{ online: number }>>(`${this.base}/quantos`),
      );
      this.online.set(res.data.online);
      return res.data.online;
    } catch {
      return this.online();
    }
  }
}
