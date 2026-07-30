import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { CHAVE_ACCESS } from '../constants/sessao';

/** Espera antes de gravar. Filtro se mexe em rajada (o usuário digita na busca, marca três
 * caixas seguidas); sem isto seria um PUT por tecla. */
const DEBOUNCE_MS = 400;

/** Preferências de tela do usuário logado — hoje, a seleção de filtros de cada tela.
 *
 * Guardadas no BANCO, por usuário (`/api/preferencias`), e não no `localStorage`: o pedido é
 * "salvar por usuário logado", ou seja, a seleção segue a PESSOA — ela abre o Painel de
 * outra máquina e encontra a tela como deixou. O mapa inteiro vem numa chamada só, no
 * primeiro uso, porque são poucos bytes e evita uma ida ao servidor por tela.
 *
 * As telas não falam com este serviço direto: usam o helper `filtrosSalvos()`
 * (`core/utils/filtros-salvos.ts`), que cuida de restaurar e de gravar. */
@Injectable({ providedIn: 'root' })
export class PreferenciasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/preferencias`;

  private valores = new Map<string, unknown>();
  /** JSON da última versão SINCRONIZADA com o servidor, por chave — base do dedupe. */
  private sincronizado = new Map<string, string>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private carregado = false;
  private emCurso: Promise<void> | null = null;

  /** O mapa já está em memória? Quem consulta é o `filtrosSalvos()`: com o mapa carregado
   * (o `authGuard` faz isso ao entrar), a restauração dos filtros é síncrona. */
  get carregadas(): boolean {
    return this.carregado;
  }

  /** Carrega o mapa uma vez (chamadas concorrentes compartilham a mesma promessa). */
  async garantirCarregado(): Promise<void> {
    if (this.carregado) return;
    this.emCurso ??= this.carregar();
    await this.emCurso;
  }

  /** Há sessão aberta? `/api/preferencias` é autenticado — sem token, chamar só renderia um
   * 401 (a tela de login não tem filtro a restaurar). */
  private temSessao(): boolean {
    return !!localStorage.getItem(CHAVE_ACCESS);
  }

  async carregar(): Promise<void> {
    // Sem sessão não marca `carregado`: assim a primeira tela aberta DEPOIS do login ainda
    // busca as preferências, em vez de herdar um "já tentei, deu vazio".
    if (!this.temSessao()) {
      this.valores.clear();
      this.sincronizado.clear();
      this.emCurso = null;
      return;
    }
    try {
      const res = await firstValueFrom(
        this.http.get<ApiEnvelope<{ preferencias: Record<string, unknown> }>>(
          this.base,
        ),
      );
      this.valores = new Map(Object.entries(res.data.preferencias ?? {}));
      this.sincronizado = new Map(
        [...this.valores].map(([k, v]) => [k, JSON.stringify(v)]),
      );
      // `carregado` mesmo em caso de erro: preferência é conveniência, e insistir a cada
      // tela abrindo transformaria um backend fora do ar em uma enxurrada de chamadas.
    } catch {
      this.valores.clear();
      this.sincronizado.clear();
    } finally {
      this.carregado = true;
      this.emCurso = null;
    }
  }

  /** Descarta o que está em memória — chamado na troca de sessão: filtro é por usuário, e
   * herdar a seleção de quem estava logado antes na mesma aba seria um vazamento. */
  limpar(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.valores.clear();
    this.sincronizado.clear();
    this.carregado = false;
  }

  ler<T>(chave: string): T | null {
    return (this.valores.get(chave) as T | undefined) ?? null;
  }

  /** Agenda a gravação. Não devolve promessa de propósito: a tela não espera por isto — se
   * a gravação falhar, o pior que acontece é a próxima visita abrir com o filtro anterior. */
  salvar(chave: string, valor: unknown): void {
    if (!this.temSessao()) return;
    const json = JSON.stringify(valor ?? null);
    if (this.sincronizado.get(chave) === json) return; // nada mudou desde a última gravação
    this.valores.set(chave, valor);
    const anterior = this.timers.get(chave);
    if (anterior) clearTimeout(anterior);
    this.timers.set(
      chave,
      setTimeout(() => {
        this.timers.delete(chave);
        void this.gravar(chave, valor, json);
      }, DEBOUNCE_MS),
    );
  }

  private async gravar(
    chave: string,
    valor: unknown,
    json: string,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put<ApiEnvelope<{ salvo: boolean }>>(
          `${this.base}/${encodeURIComponent(chave)}`,
          { valor },
        ),
      );
      this.sincronizado.set(chave, json);
    } catch {
      // Deixa `sincronizado` desatualizado a propósito: a próxima mexida no filtro tenta de
      // novo, em vez de o dedupe achar que já gravou.
    }
  }

  /** Esquece a preferência desta tela (volta a abrir nos padrões dela).
   *
   * `jsonAtual` é o estado que a tela tem AGORA (já nos padrões): entra no dedupe para que a
   * gravação automática que vem logo atrás não recrie o que acabamos de apagar. */
  async descartar(chave: string, jsonAtual: string): Promise<void> {
    if (!this.temSessao()) return;
    const t = this.timers.get(chave);
    if (t) clearTimeout(t);
    this.timers.delete(chave);
    this.valores.delete(chave);
    this.sincronizado.set(chave, jsonAtual);
    try {
      await firstValueFrom(
        this.http.delete<ApiEnvelope<{ removido: boolean }>>(
          `${this.base}/${encodeURIComponent(chave)}`,
        ),
      );
    } catch {
      this.sincronizado.delete(chave);
    }
  }
}
