import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './auth.service';
import { PresencaService } from './presenca.service';

/** Quanto tempo SEM ATIVIDADE derruba a sessão. Regra do usuário (2026-09-03): 30 minutos,
 * nos dois lados — consultor e cliente. */
export const OCIOSIDADE_MS = 30 * 60 * 1000;

/** De quanto em quanto tempo se confere o relógio. Um minuto basta: o corte é de 30, e
 * conferir de segundo em segundo só gastaria bateria. */
const CHECAGEM_MS = 60_000;

/** Último instante de atividade, compartilhado entre as ABAS do mesmo navegador.
 *
 * Em `localStorage` de propósito — ao contrário do id de sessão da presença, que é por aba.
 * Quem está trabalhando numa aba não pode ser derrubado na outra: para a pessoa é a mesma
 * sessão, e deslogar a aba de trás enquanto ela digita na da frente seria um defeito, não
 * uma proteção. */
const CHAVE_ATIVIDADE = 'painel.atividade.ultimo';

/** Derruba a sessão depois de 30 minutos de ociosidade, obrigando a entrar de novo.
 *
 * **Por que isto não existia:** o access token dura 15 minutos, mas o refresh renova sozinho,
 * então uma aba esquecida aberta permanecia logada indefinidamente — inclusive numa máquina
 * compartilhada, e inclusive do lado CLIENTE, que é acesso externo.
 *
 * **O que conta como atividade:** gesto de gente (ponteiro, teclado, rolagem, toque) e troca
 * de tela. O que NÃO conta, de propósito: a batida de presença de 45 s e qualquer outra
 * chamada de fundo — se tráfego automático contasse, o temporizador nunca chegaria ao fim e
 * esta guarda não existiria de fato. É a mesma distinção que a presença já faz entre "a aba
 * está aberta" e "tem gente ali". */
@Injectable({ providedIn: 'root' })
export class InatividadeService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly presenca = inject(PresencaService);

  private temporizador: ReturnType<typeof setInterval> | null = null;
  private ligado = false;
  private encerrando = false;
  private readonly aoAgir = () => this.marcar();

  /** Eventos que contam como gente mexendo. `pointerdown` cobre mouse, caneta e toque;
   * `keydown` cobre quem só digita; `wheel`/`touchmove` cobrem quem só lê e rola. */
  private static readonly EVENTOS = [
    'pointerdown',
    'keydown',
    'wheel',
    'touchmove',
  ] as const;

  /** Começa a vigiar. Chamado pelo shell, que só existe autenticado. */
  iniciar(): void {
    if (this.ligado) return;
    this.ligado = true;
    this.encerrando = false;

    this.marcar();
    for (const ev of InatividadeService.EVENTOS) {
      window.addEventListener(ev, this.aoAgir, { passive: true });
    }
    // Navegar é atividade, e é o único sinal de quem usa o Painel só pelo teclado do menu.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.marcar());

    this.temporizador = setInterval(() => void this.conferir(), CHECAGEM_MS);
  }

  /** Para de vigiar — no logout, para o temporizador não sobreviver à sessão. */
  parar(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.ligado = false;
    for (const ev of InatividadeService.EVENTOS) {
      window.removeEventListener(ev, this.aoAgir);
    }
  }

  /** Quanto falta para cair, em milissegundos. Exposto para teste e para um eventual aviso
   * de "sua sessão expira em…" na tela. */
  restanteMs(agora = Date.now()): number {
    return OCIOSIDADE_MS - (agora - this.ultimoMs());
  }

  private ultimoMs(): number {
    try {
      const bruto = Number(localStorage.getItem(CHAVE_ATIVIDADE));
      // Sem marca (primeira carga, aba anônima) vale AGORA: derrubar quem acabou de entrar
      // porque a chave não existia seria o pior comportamento possível aqui.
      return Number.isFinite(bruto) && bruto > 0 ? bruto : Date.now();
    } catch {
      return Date.now();
    }
  }

  private marcar(): void {
    try {
      localStorage.setItem(CHAVE_ATIVIDADE, String(Date.now()));
    } catch {
      // Navegador sem storage: a guarda se desliga sozinha em vez de derrubar a sessão.
    }
  }

  private async conferir(): Promise<void> {
    if (!this.ligado || this.encerrando) return;
    if (this.restanteMs() > 0) return;

    // `encerrando` evita a corrida entre o temporizador e um logout já em andamento —
    // duas chamadas de logout deixariam o segundo `navigate` sem sessão para limpar.
    this.encerrando = true;
    this.parar();
    try {
      localStorage.removeItem(CHAVE_ATIVIDADE);
      await this.presenca.encerrar();
      await this.auth.logout();
    } finally {
      // O login avisa POR QUE a sessão caiu. Sem isto a pessoa volta para a tela de entrada
      // sem entender o que aconteceu e acha que o Painel a expulsou por defeito.
      await this.router.navigate(['/login'], {
        queryParams: { motivo: 'ociosidade' },
      });
    }
  }
}
