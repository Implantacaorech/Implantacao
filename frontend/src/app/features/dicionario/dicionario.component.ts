import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DicionarioService } from '../../core/services/dicionario.service';
import {
  FiltroSigla,
  RespostaDicionario,
  ResultadoPesquisaDicionario,
  StatusDicionario,
} from '../../core/models/dicionario.model';

const DEBOUNCE_MS = 350;

/** Dicionário Inteligente do SIGER® — consulta técnica sobre os 87 documentos curados
 * (módulos + adicionais). Dois modos: busca por termo/filtros e "perguntar" em linguagem
 * natural (resposta fundamentada nos documentos, com fontes citadas — nunca inventa). */
@Component({
  selector: 'app-dicionario',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './dicionario.component.html',
  styleUrl: './dicionario.component.css',
})
export class DicionarioComponent {
  private readonly service = inject(DicionarioService);
  private readonly destroyRef = inject(DestroyRef);
  private debounceId: ReturnType<typeof setTimeout> | null = null;

  readonly aba = signal<'buscar' | 'perguntar'>('buscar');

  // Busca
  readonly termo = signal('');
  readonly filtroTipo = signal<'' | 'modulo' | 'adicional'>('');
  readonly filtroSigla = signal('');
  readonly buscando = signal(false);
  readonly resultados = signal<ResultadoPesquisaDicionario[]>([]);
  readonly jaBuscou = signal(false);
  readonly siglas = signal<FiltroSigla[]>([]);
  readonly status = signal<StatusDicionario | null>(null);

  // Perguntar
  readonly pergunta = signal('');
  readonly perguntando = signal(false);
  readonly resposta = signal<RespostaDicionario | null>(null);
  readonly erro = signal<string | null>(null);

  constructor() {
    void this.carregarMeta();
    this.destroyRef.onDestroy(() => {
      if (this.debounceId) clearTimeout(this.debounceId);
    });
  }

  private async carregarMeta(): Promise<void> {
    try {
      const [siglas, status] = await Promise.all([this.service.siglas(), this.service.status()]);
      this.siglas.set(siglas);
      this.status.set(status);
    } catch {
      // Metadados são convenientes, não bloqueantes.
    }
  }

  trocarAba(aba: 'buscar' | 'perguntar'): void {
    this.aba.set(aba);
  }

  onTermoAlterado(valor: string): void {
    this.termo.set(valor);
    this.agendarBusca();
  }

  onFiltroTipo(valor: string): void {
    this.filtroTipo.set(valor as '' | 'modulo' | 'adicional');
    void this.buscar();
  }

  onFiltroSigla(valor: string): void {
    this.filtroSigla.set(valor);
    void this.buscar();
  }

  private agendarBusca(): void {
    if (this.debounceId) clearTimeout(this.debounceId);
    this.debounceId = setTimeout(() => void this.buscar(), DEBOUNCE_MS);
  }

  async buscar(): Promise<void> {
    const q = this.termo().trim();
    const tipo = this.filtroTipo();
    const sigla = this.filtroSigla();
    if (!q && !tipo && !sigla) {
      this.resultados.set([]);
      this.jaBuscou.set(false);
      return;
    }
    this.buscando.set(true);
    this.erro.set(null);
    try {
      this.resultados.set(
        await this.service.pesquisar({ q: q || undefined, tipo: tipo || undefined, sigla: sigla || undefined }),
      );
      this.jaBuscou.set(true);
    } catch {
      this.erro.set('Não foi possível pesquisar agora.');
    } finally {
      this.buscando.set(false);
    }
  }

  async perguntar(): Promise<void> {
    const p = this.pergunta().trim();
    if (p.length < 3) return;
    this.perguntando.set(true);
    this.erro.set(null);
    this.resposta.set(null);
    try {
      this.resposta.set(await this.service.perguntar(p));
    } catch {
      this.erro.set('Não foi possível responder agora.');
    } finally {
      this.perguntando.set(false);
    }
  }

  async copiarResposta(): Promise<void> {
    const r = this.resposta();
    if (r && navigator.clipboard) {
      await navigator.clipboard.writeText(r.resposta);
    }
  }
}
