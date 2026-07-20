import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AgentesService } from '../../../core/services/agentes.service';
import { AgenteExecucao, ArestaGrafoAgente, NoGrafoAgente } from '../../../core/models/agente.model';

interface NoPosicionado extends NoGrafoAgente {
  x: number;
  y: number;
}

interface ArestaPosicionada extends ArestaGrafoAgente {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const INTERVALO_POLL_MS = 4000;
const RAIO = 165;
const CENTRO = 200;

/** Grafo real dos agentes/subagentes (.claude/agents/) + execuções ao vivo — nunca dado
 * simulado: "ativo" só fica true quando um agente de verdade chamou `POST
 * /api/agentes/execucoes` e ainda não chamou o `PATCH` de conclusão. Atualiza por polling
 * (sem WebSocket — não vale a complexidade extra para uma tela de baixo tráfego). */
@Component({
  selector: 'app-agentes-grafo',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './agentes-grafo.component.html',
  styleUrl: './agentes-grafo.component.css',
})
export class AgentesGrafoComponent {
  private readonly service = inject(AgentesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly nos = signal<NoGrafoAgente[]>([]);
  readonly arestas = signal<ArestaGrafoAgente[]>([]);
  readonly execucoes = signal<AgenteExecucao[]>([]);

  readonly nosPosicionados = computed<NoPosicionado[]>(() => {
    const lista = this.nos();
    const n = lista.length || 1;
    return lista.map((no, i) => {
      const angulo = (i / n) * 2 * Math.PI - Math.PI / 2;
      return {
        ...no,
        x: CENTRO + RAIO * Math.cos(angulo),
        y: CENTRO + RAIO * Math.sin(angulo),
      };
    });
  });

  readonly arestasPosicionadas = computed<ArestaPosicionada[]>(() => {
    const porId = new Map(this.nosPosicionados().map((n) => [n.id, n]));
    return this.arestas()
      .map((a) => {
        const de = porId.get(a.de);
        const para = porId.get(a.para);
        if (!de || !para) return null;
        return { ...a, x1: de.x, y1: de.y, x2: para.x, y2: para.y };
      })
      .filter((a): a is ArestaPosicionada => a !== null);
  });

  readonly totalAtivos = computed(() => this.nos().filter((n) => n.ativo).length);

  constructor() {
    void this.carregar();
    const id = setInterval(() => void this.carregar(), INTERVALO_POLL_MS);
    this.destroyRef.onDestroy(() => clearInterval(id));
  }

  private async carregar(): Promise<void> {
    try {
      // Sequencial (não Promise.all) — mesmo padrão de espera dos demais componentes deste
      // módulo, mais simples de estabilizar em teste.
      const grafo = await this.service.grafo();
      const execucoes = await this.service.execucoes(15);
      this.nos.set(grafo.nos);
      this.arestas.set(grafo.arestas);
      this.execucoes.set(execucoes);
      this.erro.set(null);
    } catch {
      this.erro.set('Não foi possível carregar os agentes.');
    } finally {
      this.carregando.set(false);
    }
  }
}
