/**
 * Métricas de latência por ROTA — em memória. Achado do eixo 9 (Observabilidade) da auditoria de
 * 2026-08-12: havia correlation-id (M9) e contador de 5xx (A12), mas nenhuma noção de "quanto
 * cada rota está demorando". Sem isso, uma rota que degrada de 80 ms para 4 s passa despercebida
 * até virar reclamação — não há número para olhar antes.
 *
 * Agrega por TEMPLATE de rota (`GET /projetos/:id`), não por URL concreta, de propósito: senão
 * cada id viraria uma chave e a métrica explodiria em cardinalidade, sem servir para nada.
 *
 * SINGLETON DE MÓDULO como `contador5xx`/`heartbeatRobos`: alimentado por um interceptor global
 * (fora do container de DI) e lido pelo SaudeService. Estado VOLÁTIL (zera no restart) — adequado
 * para "como está o desempenho agora?". Amostras limitadas por rota para o array não crescer sem
 * teto num pico de tráfego.
 */
export interface ResumoRota {
  rota: string;
  chamadas: number;
  mediaMs: number;
  p95Ms: number;
  maxMs: number;
}

/** Quantas durações recentes guardar por rota (para o p95). 200 é barato e estável o bastante. */
const MAX_AMOSTRAS = 200;

interface Acumulado {
  chamadas: number;
  somaMs: number;
  maxMs: number;
  amostras: number[];
}

/** p-ésimo percentil de um array (cópia ordenada) — método do "nearest rank". */
function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const idx = Math.min(
    ordenado.length - 1,
    Math.ceil((p / 100) * ordenado.length) - 1,
  );
  return Math.round(ordenado[Math.max(0, idx)]);
}

class MetricasLatencia {
  private rotas = new Map<string, Acumulado>();

  registrar(rota: string, ms: number): void {
    let a = this.rotas.get(rota);
    if (!a) {
      a = { chamadas: 0, somaMs: 0, maxMs: 0, amostras: [] };
      this.rotas.set(rota, a);
    }
    a.chamadas += 1;
    a.somaMs += ms;
    if (ms > a.maxMs) a.maxMs = ms;
    a.amostras.push(ms);
    if (a.amostras.length > MAX_AMOSTRAS) a.amostras.shift();
  }

  /** Resumo por rota, ordenado do p95 mais alto para o mais baixo (o que dói primeiro no topo). */
  resumo(): ResumoRota[] {
    return [...this.rotas.entries()]
      .map(([rota, a]) => ({
        rota,
        chamadas: a.chamadas,
        mediaMs: Math.round(a.somaMs / a.chamadas),
        p95Ms: percentil(a.amostras, 95),
        maxMs: Math.round(a.maxMs),
      }))
      .sort((x, y) => y.p95Ms - x.p95Ms);
  }

  /** Só para teste — zera o estado entre casos. */
  _resetar(): void {
    this.rotas.clear();
  }
}

export const metricasLatencia = new MetricasLatencia();
