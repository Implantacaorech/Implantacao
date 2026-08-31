/**
 * Contador de erros 5xx das últimas 24 h — em memória. Achado A12 da auditoria de 2026-08-12:
 * um 5xx só ia para o log e ninguém era avisado (14× "Table preferencias_usuario doesn't
 * exist" em 30/07, 5 min de recurso quebrado, zero alarme). O `HttpExceptionFilter` alimenta
 * este contador e o `SaudeService` o expõe como uma checagem de `/api/saude`, que sai no digest
 * diário — o mesmo canal que fecha os outros buracos de detecção.
 *
 * É um SINGLETON DE MÓDULO de propósito: o filtro global é criado com `new` em `main.ts` (fora
 * do container de DI), então injetar um serviço nele seria contorcido. O cache de módulos do
 * Node garante que filtro e SaudeService enxergam a MESMA instância. O estado é volátil (some
 * no restart) — é aceitável: a janela é de 24 h e o que importa é "está acontecendo agora?".
 */
export interface Evento5xx {
  status: number;
  rota: string;
  /** epoch ms. */
  em: number;
}

export interface Resumo5xx {
  total24h: number;
  ultimo: { status: number; rota: string; em: string } | null;
}

const JANELA_MS = 24 * 60 * 60 * 1000;
/** Teto de memória — um pico de erros não pode crescer o array sem limite. */
const MAX_EVENTOS = 500;

class Contador5xx {
  private eventos: Evento5xx[] = [];

  /** Registra um 5xx. Ignora < 500 (4xx é erro do cliente, não incidente do servidor). */
  registrar(status: number, rota: string): void {
    if (status < 500 || status > 599) return;
    const agora = Date.now();
    this.eventos.push({ status, rota, em: agora });
    this.podar(agora);
  }

  private podar(agora: number): void {
    const limite = agora - JANELA_MS;
    this.eventos = this.eventos.filter((e) => e.em >= limite);
    if (this.eventos.length > MAX_EVENTOS) {
      this.eventos = this.eventos.slice(-MAX_EVENTOS);
    }
  }

  resumo(): Resumo5xx {
    this.podar(Date.now());
    const ult = this.eventos[this.eventos.length - 1] ?? null;
    return {
      total24h: this.eventos.length,
      ultimo: ult
        ? {
            status: ult.status,
            rota: ult.rota,
            em: new Date(ult.em).toISOString(),
          }
        : null,
    };
  }

  /** Só para teste — zera o estado entre casos. */
  _resetar(): void {
    this.eventos = [];
  }
}

export const contador5xx = new Contador5xx();
