import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ErroCaptura,
  FonteAudio,
  capturaDisponivel,
  diagnosticoCaptura,
  motivoIndisponivel,
  urlPorLocalhost,
} from '../../core/audio/captura-audio';
import { GravacaoEmAndamentoService } from '../../core/audio/gravacao-em-andamento.service';
import { ProtocoloService } from '../../core/services/protocolo.service';
import { ClienteProtocolo } from '../../core/models/protocolo.model';

/** Espera antes de consultar o SICLA — a busca vai ao Oracle, não a uma lista em memória:
 * disparar a cada tecla encheria o banco de consultas inúteis. */
const ESPERA_BUSCA_MS = 400;
/** O backend recusa termo menor que isto (mesma regra do passo 1). */
const MIN_TERMO = 2;

/** Tela da gravação de reunião com transcrição ao vivo.
 *
 * É só uma VISTA sobre `GravacaoEmAndamentoService` — quem detém o áudio, os
 * temporizadores e a fila de envio é o serviço, em nível de aplicação. Foi assim que a
 * gravação passou a sobreviver à navegação: sair desta tela (para preencher o
 * Levantamento, abrir a ficha do projeto...) não encerra mais nada, e a barra fixa do topo
 * dá pausar/encerrar de qualquer lugar do portal. */
@Component({
  selector: 'app-gravacao',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './gravacao.component.html',
  styleUrl: './gravacao.component.css',
})
export class GravacaoComponent {
  private readonly service = inject(ProtocoloService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  readonly g = inject(GravacaoEmAndamentoService);

  readonly erro = signal<string | null>(null);

  /** Resultados da última busca no SICLA. */
  readonly resultados = signal<ClienteProtocolo[]>([]);
  readonly buscando = signal(false);
  readonly mensagemBusca = signal('');

  /** Cliente escolhido na busca do SICLA (a MESMA do Novo Cliente). */
  readonly selecionado = signal<ClienteProtocolo | null>(null);
  readonly buscaCliente = signal('');
  readonly listaAberta = signal(false);

  /** Caminho alternativo: a tela foi aberta de dentro de um projeto (botão do
   * Levantamento). Aí o cliente já está decidido e nem passa pela busca. */
  readonly projetoId = signal<number | null>(null);
  readonly clienteDoProjeto = signal('');

  titulo = '';
  /** Nomes dos participantes e termos da reunião — o que mais corrige erro de nome próprio. */
  vocabulario = '';
  /** Quantas pessoas vão falar. Começa NULO de propósito: é campo obrigatório (decisão do
   * usuário em 2026-08-04) e um valor inicial decidiria calado por "não separar". A
   * separação só acontece durante a gravação — quem descobrir depois que queria teria de
   * refazer a reunião. 1 = não separar. */
  participantes: number | null = null;
  fonte: FonteAudio = 'microfone';
  /** MARCADO por padrão (decisão do usuário em 2026-07-30): a transcrição do arquivo
   * inteiro é sensivelmente melhor que a emenda dos trechos ao vivo, e é dela que sai o
   * texto que a IA lê. O ao vivo continua servindo para acompanhar a reunião. */
  retranscrever = true;

  readonly disponivel = capturaDisponivel();
  readonly motivo = this.disponivel ? '' : motivoIndisponivel();
  readonly urlLocalhost = this.disponivel ? null : urlPorLocalhost();
  readonly diagnostico = diagnosticoCaptura();

  readonly clienteEscolhido = computed(
    () => this.selecionado()?.cliente || this.clienteDoProjeto(),
  );
  readonly temCliente = computed(
    () => !!this.selecionado() || this.projetoId() !== null,
  );
  /** Só libera o botão com a captura disponível E o número de pessoas respondido. */
  readonly podeIniciar = computed(
    () => this.disponivel && this.participantesEscolhido(),
  );
  readonly participantesEscolhido = signal(false);

  private buscaAgendada: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Chegando de outra tela do projeto (ex.: o Levantamento), o cliente e o título já vêm
    // prontos na URL — quem está começando a reunião não deveria ter de procurar o cliente.
    const q = this.rota.snapshot.queryParamMap;
    const projeto = Number(q.get('projetoId'));
    if (Number.isInteger(projeto) && projeto > 0) {
      this.projetoId.set(projeto);
      this.clienteDoProjeto.set(q.get('cliente') ?? '');
      this.buscaCliente.set(q.get('cliente') ?? '');
    }
    this.titulo = q.get('titulo') ?? '';
    // Voltando a esta tela com a gravação já rolando, o título mostrado é o dela.
    if (this.g.ativa()) this.titulo = this.g.titulo();
  }

  // ------------------------------------------------------------ busca de cliente

  private async buscarNoSicla(termo: string): Promise<void> {
    if (termo.trim().length < MIN_TERMO) {
      this.resultados.set([]);
      this.mensagemBusca.set('Digite ao menos ' + MIN_TERMO + ' caracteres.');
      return;
    }
    this.buscando.set(true);
    try {
      const r = await this.service.buscarClientes(termo);
      this.resultados.set(r.clientes);
      this.mensagemBusca.set(
        r.ok && r.clientes.length === 0
          ? 'Nenhum cliente encontrado no SICLA com esse código ou nome.'
          : (r.mensagem ?? ''),
      );
    } catch (e) {
      this.resultados.set([]);
      this.mensagemBusca.set(this.mensagemErroClientes(e));
    } finally {
      this.buscando.set(false);
    }
  }

  private mensagemErroClientes(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      // Backend desatualizado se manifesta de DUAS formas, e a segunda engana:
      // - 404: a rota não existe mesmo;
      // - 400 "numeric string is expected": a rota /protocolos/clientes cai na
      //   /protocolos/:id da versão antiga e o ParseIntPipe recusa a palavra "clientes".
      const detalhe =
        typeof e.error?.message === 'string'
          ? e.error.message
          : (e.statusText ?? '');
      const rotaAntiga =
        e.status === 404 ||
        (e.status === 400 && /numeric string is expected/i.test(detalhe));
      if (rotaAntiga) {
        return (
          'A busca de clientes no SICLA não existe neste backend. O Painel está rodando uma ' +
          'versão anterior à da gravação de reuniões — rode Build_Painel_Novo.bat (que também ' +
          'aplica as migrations) e reinicie com Iniciar_Painel_Novo.bat.'
        );
      }
      if (e.status === 0) {
        return 'Sem resposta do servidor. Verifique se o Painel está no ar.';
      }
      if (e.status === 401) return 'Sessão expirada. Entre novamente.';
      if (e.status === 403) {
        return 'Sem permissão para o menu Transcrição Áudio/Vídeo (Gestão → Permissões).';
      }
      return `Falha ao buscar no SICLA (HTTP ${e.status}): ${detalhe}`;
    }
    return 'Não foi possível consultar os clientes no SICLA.';
  }

  aoDigitarCliente(valor: string): void {
    this.buscaCliente.set(valor);
    this.listaAberta.set(true);
    // Digitar desfaz a escolha anterior: o que vale é o que foi CLICADO na lista, nunca o
    // texto solto — senão daria para "escolher" um cliente que não existe no SICLA.
    this.selecionado.set(null);
    this.projetoId.set(null);
    this.clienteDoProjeto.set('');
    if (this.buscaAgendada) clearTimeout(this.buscaAgendada);
    this.buscaAgendada = setTimeout(
      () => void this.buscarNoSicla(valor),
      ESPERA_BUSCA_MS,
    );
  }

  escolherCliente(c: ClienteProtocolo | null): void {
    this.selecionado.set(c);
    this.buscaCliente.set(c?.cliente ?? '');
    this.listaAberta.set(false);
    this.mensagemBusca.set('');
    if (!c) {
      this.projetoId.set(null);
      this.clienteDoProjeto.set('');
    }
  }

  /** O clique numa opção acontece DEPOIS do blur do campo — daí o atraso, senão a lista
   * sumiria antes de a escolha ser registrada. */
  fecharListaEmBreve(): void {
    setTimeout(() => this.listaAberta.set(false), 180);
  }

  // ------------------------------------------------------------------- gravação

  async iniciar(): Promise<void> {
    this.erro.set(null);
    if (!this.disponivel) {
      this.erro.set(this.motivo);
      return;
    }
    const escolhido = this.selecionado();
    try {
      await this.g.iniciar({
        fonte: this.fonte,
        titulo: this.titulo.trim() || undefined,
        projetoId: this.projetoId() ?? undefined,
        clienteCodigo: escolhido?.codigo,
        cliente: escolhido?.cliente,
        cnpj: escolhido?.cnpj,
        vocabulario: this.vocabulario.trim() || undefined,
        participantes: Number(this.participantes) || 1,
        clienteRotulo: this.clienteEscolhido(),
      });
      this.titulo = this.g.titulo();
    } catch (e) {
      this.erro.set(
        e instanceof ErroCaptura
          ? e.message
          : 'Não foi possível iniciar a gravação. Verifique se o serviço de transcrição está no ar.',
      );
    }
  }

  async encerrar(): Promise<void> {
    await this.g.encerrar({
      titulo: this.titulo.trim() || undefined,
      retranscrever: this.retranscrever,
    });
  }

  async descartar(): Promise<void> {
    if (!confirm('Descartar esta gravação? O áudio e a transcrição serão apagados.')) {
      return;
    }
    await this.g.descartar();
    void this.router.navigate(['/protocolos']);
  }

  /** Volta ao formulário para gravar outra reunião. */
  novaGravacao(): void {
    this.g.limpar();
    this.erro.set(null);
    this.titulo = '';
    this.retranscrever = true;
    this.participantes = null;
    this.participantesEscolhido.set(false);
  }

  aoEscolherParticipantes(valor: string): void {
    this.participantes = valor === '' ? null : Number(valor);
    this.participantesEscolhido.set(this.participantes !== null);
  }

  formatarDuracao(seg: number): string {
    return this.g.formatarDuracao(seg);
  }
}
