import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PassosService } from '../../core/services/passos.service';
import { ProjetosService } from '../../core/services/projetos.service';
import {
  PASSOS_COM_ANEXO_DE_EMAIL,
  Passo,
  Rns,
  TIPOS_RNS,
  TipoRns,
} from '../../core/models/passo.model';

/** Tela dos 18 passos do processo de implantação de um projeto.
 *
 * Mostra o que já foi feito, o que está liberado para QUEM ESTÁ OLHANDO e, quando não está,
 * o motivo em linguagem de negócio — quem é o responsável ou qual passo falta. Quem decide
 * tudo isso é o backend; aqui só se apresenta. */
@Component({
  selector: 'app-passos',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './passos.component.html',
  styleUrl: './passos.component.css',
})
export class PassosComponent {
  private readonly service = inject(PassosService);
  private readonly projetos = inject(ProjetosService);
  private readonly route = inject(ActivatedRoute);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly cliente = signal('');
  readonly passos = signal<Passo[]>([]);
  readonly rns = signal<Rns[]>([]);
  readonly ocupado = signal<number | null>(null);
  /** Passos cujo e-mail foi anexado nesta sessão — feedback imediato na tela. */
  readonly anexados = signal<number[]>([]);

  readonly tiposRns = TIPOS_RNS;
  novoTipo: TipoRns = 'RNI';
  novoNumero = '';
  novaDescricao = '';

  readonly concluidos = computed(
    () => this.passos().filter((p) => p.concluido).length,
  );

  readonly progresso = computed(() => {
    const total = this.passos().length;
    return total === 0 ? 0 : Math.round((this.concluidos() / total) * 100);
  });

  /** Passos agrupados por macro-etapa, preservando a ordem do processo. */
  readonly porEtapa = computed(() => {
    const grupos = new Map<string, Passo[]>();
    for (const p of this.passos()) {
      const lista = grupos.get(p.etapa);
      if (lista) lista.push(p);
      else grupos.set(p.etapa, [p]);
    }
    return [...grupos.entries()].map(([etapa, itens]) => ({ etapa, itens }));
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [passos, projeto, rns] = await Promise.all([
        this.service.listar(this.projetoId),
        this.projetos.buscar(this.projetoId),
        this.service.listarRns(this.projetoId),
      ]);
      this.passos.set(passos);
      this.cliente.set(projeto.cliente);
      this.rns.set(rns);
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.carregando.set(false);
    }
  }

  private mensagem(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const corpo = e.error as { message?: string } | undefined;
      return corpo?.message ?? `Falha na comunicação (HTTP ${e.status}).`;
    }
    return 'Falha inesperada.';
  }

  private async executar(
    numero: number,
    acao: () => Promise<Passo[]>,
  ): Promise<void> {
    this.ocupado.set(numero);
    this.erro.set(null);
    try {
      this.passos.set(await acao());
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
    }
  }

  concluir(p: Passo): Promise<void> {
    return this.executar(p.numero, () =>
      this.service.concluir(this.projetoId, p.numero),
    );
  }

  conferir(p: Passo): Promise<void> {
    return this.executar(p.numero, () =>
      this.service.conferir(this.projetoId, p.numero),
    );
  }

  reabrir(p: Passo): Promise<void> {
    return this.executar(p.numero, () =>
      this.service.reabrir(this.projetoId, p.numero),
    );
  }

  /** Passo 9 e 16: concluído mas ainda sem a conferência que libera o seguinte. */
  aguardandoConferencia(p: Passo): boolean {
    return p.concluido && !p.conferido && this.temConferencia(p);
  }

  temConferencia(p: Passo): boolean {
    return p.numero === 9 || p.numero === 16;
  }

  /** Passos 3 e 4: o e-mail sai do Outlook da pessoa; o Painel guarda a PROVA. */
  aceitaAnexoDeEmail(p: Passo): boolean {
    return PASSOS_COM_ANEXO_DE_EMAIL.includes(p.numero);
  }

  async anexarEmail(p: Passo, evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    this.ocupado.set(p.numero);
    this.erro.set(null);
    try {
      await this.service.anexarEmail(this.projetoId, p.numero, arquivo);
      this.anexados.update((atual) => [...atual, p.numero]);
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
      input.value = '';
    }
  }

  async acrescentarRns(): Promise<void> {
    this.erro.set(null);
    try {
      await this.service.criarRns(this.projetoId, {
        tipo: this.novoTipo,
        numero: this.novoNumero,
        descricao: this.novaDescricao,
      });
      this.rns.set(await this.service.listarRns(this.projetoId));
      this.novoNumero = '';
      this.novaDescricao = '';
    } catch (e) {
      this.erro.set(this.mensagem(e));
    }
  }

  async removerRns(id: number): Promise<void> {
    this.erro.set(null);
    try {
      await this.service.removerRns(this.projetoId, id);
      this.rns.set(await this.service.listarRns(this.projetoId));
    } catch (e) {
      this.erro.set(this.mensagem(e));
    }
  }
}
