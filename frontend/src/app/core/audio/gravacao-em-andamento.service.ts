import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ProtocoloService } from '../services/protocolo.service';
import { CapturaAudio, ErroCaptura, FonteAudio } from './captura-audio';

export type FaseGravacao =
  | 'parada'
  | 'gravando'
  | 'encerrando'
  | 'concluida';

const INTERVALO_ESTADO_MS = 5000;

export interface DadosInicioGravacao {
  fonte: FonteAudio;
  titulo?: string;
  projetoId?: number;
  clienteCodigo?: string;
  cliente?: string;
  cnpj?: string;
  /** Nomes dos participantes e termos ditados na reunião (hotwords do transcritor). */
  vocabulario?: string;
  /** Quantas pessoas vão falar (>= 2 separa as vozes na transcrição). */
  participantes?: number;
  /** Nome do cliente para exibir enquanto a gravação corre. */
  clienteRotulo?: string;
}

/** Dono da gravação de reunião em andamento — em nível de APLICAÇÃO, não de tela.
 *
 * Por que aqui e não no componente: a captura precisa sobreviver à navegação. Quem grava
 * uma reunião de levantamento passa a reunião inteira preenchendo o formulário do
 * Levantamento, consultando a ficha do projeto, abrindo o cronograma — e não pode perder o
 * áudio a cada clique no menu. Com o serviço em `providedIn: 'root'`, o `AudioContext`, os
 * temporizadores e a fila de envio vivem enquanto a ABA viver; a tela de gravação vira só
 * uma vista sobre este estado, e a barra fixa do topo (`BarraGravacaoComponent`) dá
 * pausar/encerrar de qualquer lugar do portal.
 *
 * O limite honesto continua existindo: recarregar a página (F5) ou fechar a aba encerra a
 * captura — o áudio já enviado fica salvo no servidor, e o protocolo permanece 'Gravando'
 * até alguém encerrar ou descartar. Daí o aviso de saída registrado pela barra. */
@Injectable({ providedIn: 'root' })
export class GravacaoEmAndamentoService {
  private readonly service = inject(ProtocoloService);
  private readonly captura = new CapturaAudio();

  readonly fase = signal<FaseGravacao>('parada');
  readonly protocoloId = signal<number | null>(null);
  readonly titulo = signal('');
  readonly cliente = signal('');
  readonly duracaoSeg = signal(0);
  readonly nivel = signal(0);
  readonly pausado = signal(false);
  readonly texto = signal('');
  readonly pendentes = signal(0);
  readonly enviando = signal(0);
  readonly transcritorPronto = signal(false);
  readonly aviso = signal<string | null>(null);
  readonly erro = signal<string | null>(null);
  /** Preenchido ao encerrar — a tela usa para oferecer o link da revisão. */
  readonly ultimaConcluida = signal<{ id: number; aviso: string } | null>(null);

  readonly ativa = computed(
    () => this.fase() === 'gravando' || this.fase() === 'encerrando',
  );

  private cronometro: ReturnType<typeof setInterval> | null = null;
  private consulta: ReturnType<typeof setInterval> | null = null;
  private fila: Promise<void> = Promise.resolve();

  async iniciar(dados: DadosInicioGravacao): Promise<void> {
    if (this.ativa()) {
      throw new ErroCaptura(
        'Já existe uma gravação em andamento nesta aba. Encerre-a antes de começar outra.',
      );
    }
    this.erro.set(null);
    this.aviso.set(null);
    this.ultimaConcluida.set(null);
    this.texto.set('');
    this.pendentes.set(0);
    this.duracaoSeg.set(0);
    this.transcritorPronto.set(false);

    let id: number | null = null;
    try {
      const inicio = await this.service.iniciarGravacao({
        projetoId: dados.projetoId,
        clienteCodigo: dados.clienteCodigo,
        cliente: dados.cliente,
        cnpj: dados.cnpj,
        titulo: dados.titulo,
        vocabulario: dados.vocabulario,
        participantes: dados.participantes,
        fonte: dados.fonte,
      });
      id = inicio.id;
      this.protocoloId.set(inicio.id);
      this.titulo.set(inicio.titulo);
      this.cliente.set(inicio.cliente || dados.clienteRotulo || '');

      await this.captura.iniciar({
        fonte: dados.fonte,
        aoTrecho: (wav, seq) => this.enfileirar(inicio.id, wav, seq),
        aoNivel: (n) => this.nivel.set(n),
        aoPerderReuniao: () =>
          this.aviso.set(
            'O compartilhamento da reunião foi interrompido — o áudio remoto parou de ser ' +
              'capturado. Encerre a gravação ou reinicie o compartilhamento.',
          ),
      });
      this.fase.set('gravando');
      this.pausado.set(false);
      this.iniciarTemporizadores();
    } catch (e) {
      // Sessão aberta no servidor não pode ficar órfã se a captura falhar depois dela.
      if (id !== null && !this.captura.ativa) {
        try {
          await this.service.cancelarGravacao(id);
        } catch {
          // Sessão já removida do outro lado — nada a desfazer.
        }
        this.protocoloId.set(null);
      }
      this.fase.set('parada');
      throw e instanceof ErroCaptura
        ? e
        : new ErroCaptura(this.mensagemErro(e));
    }
  }

  /** Envia os trechos EM SÉRIE: dois envios simultâneos disputariam a CPU do transcritor e
   * poderiam chegar fora de ordem. Falha isolada não derruba a reunião — perde-se o trecho
   * e a gravação continua, com aviso na tela. */
  private enfileirar(id: number, wav: Blob, seq: number): Promise<void> {
    this.enviando.update((n) => n + 1);
    this.fila = this.fila
      .then(() => this.service.enviarTrecho(id, seq, wav))
      .catch(() => {
        this.aviso.set(
          'Um trecho do áudio não chegou ao servidor. A gravação continua — confira o ' +
            'texto ao final.',
        );
      })
      .finally(() => this.enviando.update((n) => Math.max(0, n - 1)));
    return this.fila;
  }

  private iniciarTemporizadores(): void {
    this.pararTemporizadores();
    this.cronometro = setInterval(
      () => this.duracaoSeg.set(this.captura.duracaoSeg),
      1000,
    );
    this.consulta = setInterval(
      () => void this.atualizarEstado(),
      INTERVALO_ESTADO_MS,
    );
    void this.atualizarEstado();
  }

  private pararTemporizadores(): void {
    if (this.cronometro) clearInterval(this.cronometro);
    if (this.consulta) clearInterval(this.consulta);
    this.cronometro = null;
    this.consulta = null;
  }

  private async atualizarEstado(): Promise<void> {
    const id = this.protocoloId();
    if (id === null) return;
    try {
      const estado = await this.service.estadoGravacao(id);
      this.texto.set(estado.texto);
      this.pendentes.set(estado.pendentes);
      this.transcritorPronto.set(estado.pronto);
      if (estado.erro) this.aviso.set(estado.erro);
    } catch {
      // Falha de rede pontual: a próxima consulta (5 s) resolve. Não vale interromper a
      // reunião — o áudio continua sendo capturado e enfileirado.
    }
  }

  alternarPausa(): void {
    if (!this.ativa()) return;
    if (this.pausado()) {
      this.captura.retomar();
      this.pausado.set(false);
    } else {
      this.captura.pausar();
      this.pausado.set(true);
      this.nivel.set(0);
    }
  }

  async encerrar(opcoes: { titulo?: string; retranscrever?: boolean } = {}): Promise<void> {
    const id = this.protocoloId();
    if (id === null || this.fase() !== 'gravando') return;
    this.fase.set('encerrando');
    this.pararTemporizadores();
    this.erro.set(null);
    try {
      await this.captura.parar();
      await this.fila; // garante que o último trecho subiu antes de fechar o áudio
      const r = await this.service.finalizarGravacao(id, {
        titulo: (opcoes.titulo || this.titulo()).trim() || undefined,
        retranscrever: opcoes.retranscrever,
      });
      this.duracaoSeg.set(r.duracaoSeg);
      this.aviso.set(r.aviso);
      this.ultimaConcluida.set({ id, aviso: r.aviso });
    } catch {
      this.erro.set(
        'A gravação foi interrompida, mas o encerramento falhou. O áudio já enviado está ' +
          'no servidor — abra a lista de transcrições para tratar este registro.',
      );
      this.ultimaConcluida.set({ id, aviso: '' });
    } finally {
      this.fase.set('concluida');
      this.pausado.set(false);
      this.nivel.set(0);
    }
  }

  async descartar(): Promise<void> {
    const id = this.protocoloId();
    this.pararTemporizadores();
    try {
      await this.captura.parar();
      if (id !== null) await this.service.cancelarGravacao(id);
      this.limpar();
    } catch {
      this.erro.set('Não foi possível descartar a gravação.');
    }
  }

  /** Volta ao estado zero (a tela chama ao começar outra gravação). */
  limpar(): void {
    this.pararTemporizadores();
    this.fase.set('parada');
    this.protocoloId.set(null);
    this.titulo.set('');
    this.cliente.set('');
    this.duracaoSeg.set(0);
    this.texto.set('');
    this.pendentes.set(0);
    this.nivel.set(0);
    this.pausado.set(false);
    this.ultimaConcluida.set(null);
  }

  private mensagemErro(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0) {
        return 'Sem resposta do servidor. Verifique se o Painel está no ar.';
      }
      const detalhe =
        typeof e.error?.message === 'string' ? e.error.message : e.statusText;
      return `Não foi possível iniciar a gravação (HTTP ${e.status}): ${detalhe}`;
    }
    return (
      'Não foi possível iniciar a gravação. Verifique se o serviço de transcrição está no ar.'
    );
  }

  formatarDuracao(seg: number): string {
    const s = Math.max(0, Math.floor(seg));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const dd = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${dd(m)}:${dd(r)}` : `${dd(m)}:${dd(r)}`;
  }
}
