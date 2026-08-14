import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProtocoloService } from '../../core/services/protocolo.service';
import {
  ClienteComProtocolo,
  EnviarVisitaPortalPayload,
  Protocolo,
  PROTO_MODULOS,
  RascunhoVisita,
} from '../../core/models/protocolo.model';

/** Status de protocolo que já têm conteúdo aproveitável para o rascunho — os em andamento
 * (gravando/transcrevendo/analisando/pendente) e os que deram erro ficam de fora. */
const STATUS_COM_CONTEUDO = new Set<string>([
  'Em revisão',
  'Aprovado',
  'Reprovado / Ajustar',
]);

/** Painel "Preencher protocolo": escolhe um cliente e uma transcrição/gravação dele, monta
 * os campos do "Registro de Atendimento em Visita" do Portal Rech já preenchidos e
 * editáveis, e entrega para o consultor conferir e levar ao Portal. Toda a fala com a API
 * passa pelo `ProtocoloService` (o componente não fala HTTP direto). */
@Component({
  selector: 'app-preencher-protocolo',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './preencher-protocolo.component.html',
  styleUrl: './preencher-protocolo.component.css',
})
export class PreencherProtocoloComponent {
  private readonly service = inject(ProtocoloService);

  /** Fecha o painel (o pai controla a visibilidade). */
  readonly fechar = output<void>();

  /** Emitido quando a visita (rascunho pendente) foi criada no Portal — o pai fecha o painel
   * e recarrega a página do Portal para o novo registro aparecer. Leva o id da visita. */
  readonly criada = output<number>();

  readonly modulos = PROTO_MODULOS;

  readonly carregandoClientes = signal(true);
  readonly clientes = signal<ClienteComProtocolo[]>([]);
  readonly clienteSel = signal<string>('');

  readonly carregandoProtocolos = signal(false);
  readonly protocolos = signal<Protocolo[]>([]);
  readonly protocoloSel = signal<number | null>(null);

  readonly carregandoRascunho = signal(false);
  readonly rascunho = signal<RascunhoVisita | null>(null);

  readonly erro = signal<string | null>(null);
  /** Marca qual bloco acabou de ser copiado, para o feedback visual sumir sozinho. */
  readonly copiado = signal<string | null>(null);

  // ---- Campos editáveis do atendimento (o "abrir na tela os campos" pedido pelo usuário).
  // Pré-preenchidos quando o rascunho carrega; o consultor ajusta antes de levar ao Portal.
  /** Código do cliente no SICLA — é ele que localiza a empresa no Portal. Editável para
   * corrigir/preencher quando o protocolo veio sem código. */
  readonly clienteCodigo = signal('');
  readonly contato = signal('');
  readonly inicioDeslocamento = signal('');
  readonly inicioVisita = signal('');
  readonly fimVisita = signal('');
  readonly fimDeslocamento = signal('');
  readonly modulo = signal('');
  readonly descricao = signal('');
  // Extras opcionais (o Portal também tem) — ficam recolhidos para não poluir.
  readonly kmInicial = signal('');
  readonly kmFinal = signal('');
  readonly custoPedagio = signal('');
  readonly custoEstadia = signal('');
  readonly custoAlimentacao = signal('');
  readonly custoEstacionamento = signal('');
  readonly mostrarExtras = signal(false);

  // ---- Credencial do Portal Rech (por consultor) + estado do envio.
  readonly temCredencial = signal(false);
  readonly credLogin = signal('');
  /** Mostra o mini-formulário de login/senha do Portal (obrigatório no 1º uso). */
  readonly pedindoCredencial = signal(false);
  readonly formLogin = signal('');
  readonly formSenha = signal('');
  readonly salvandoCred = signal(false);
  readonly enviando = signal(false);
  /** Id da visita criada como rascunho no Portal — quando preenchido, o envio deu certo. */
  readonly visitaCriada = signal<number | null>(null);

  /** Cliente escolhido, formatado como "código - fantasia" (ex.: "16897 - BRASOJA"), igual ao
   * jeito que o Portal identifica a empresa. Cai para a razão social se não houver fantasia. */
  readonly clienteInfo = computed(() => {
    const r = this.rascunho();
    if (!r) return '';
    const nome = r.clienteFantasia?.trim() || r.cliente;
    return `${r.clienteCodigo ? r.clienteCodigo + ' - ' : ''}${nome}`;
  });

  constructor() {
    void this.carregarClientes();
    void this.carregarCredencial();
  }

  private async carregarCredencial(): Promise<void> {
    try {
      const c = await this.service.credencialPortal();
      this.temCredencial.set(c.tem);
      this.credLogin.set(c.login);
    } catch {
      // Falha ao consultar não trava a tela: o gate real está no envio.
    }
  }

  private async carregarClientes(): Promise<void> {
    this.carregandoClientes.set(true);
    this.erro.set(null);
    try {
      this.clientes.set(await this.service.clientesComProtocolo());
    } catch {
      this.erro.set('Não foi possível carregar os clientes.');
    } finally {
      this.carregandoClientes.set(false);
    }
  }

  async onClienteAlterado(nome: string): Promise<void> {
    this.clienteSel.set(nome);
    this.protocoloSel.set(null);
    this.rascunho.set(null);
    this.protocolos.set([]);
    if (!nome) return;
    this.carregandoProtocolos.set(true);
    this.erro.set(null);
    try {
      const lista = await this.service.listar({ cliente: nome });
      this.protocolos.set(
        lista.itens.filter((p) => STATUS_COM_CONTEUDO.has(p.status)),
      );
      if (this.protocolos().length === 0) {
        this.erro.set(
          'Este cliente ainda não tem transcrição/gravação revisada para basear o preenchimento.',
        );
      }
    } catch {
      this.erro.set('Não foi possível carregar as transcrições do cliente.');
    } finally {
      this.carregandoProtocolos.set(false);
    }
  }

  async onProtocoloAlterado(valor: string): Promise<void> {
    const id = valor ? Number(valor) : null;
    this.protocoloSel.set(id);
    this.rascunho.set(null);
    if (!id) return;
    this.carregandoRascunho.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.rascunhoVisita(id);
      this.rascunho.set(r);
      this.preencherCampos(r);
    } catch {
      this.erro.set('Não foi possível montar o rascunho deste protocolo.');
    } finally {
      this.carregandoRascunho.set(false);
    }
  }

  /** Semeia os campos editáveis com o que veio do rascunho. As datas de visita e
   * deslocamento nascem iguais à sugestão (criação + duração da gravação); o consultor
   * corrige para a data real do atendimento e o horário de estrada. */
  private preencherCampos(r: RascunhoVisita): void {
    this.clienteCodigo.set(r.clienteCodigo ?? '');
    // Contato: quem falou na gravação; se ninguém foi nomeado, o responsável do SICLA.
    this.contato.set(r.participantes[0] ?? r.contatoSugerido ?? '');
    this.inicioDeslocamento.set(r.dataInicioSugerida ?? '');
    this.inicioVisita.set(r.dataInicioSugerida ?? '');
    this.fimVisita.set(r.dataFimSugerida ?? '');
    this.fimDeslocamento.set(r.dataFimSugerida ?? '');
    this.modulo.set(r.atividade.modulo ?? '');
    this.descricao.set(r.atividade.descricaoAtividade ?? '');
    this.kmInicial.set('');
    this.kmFinal.set('');
    this.custoPedagio.set('');
    this.custoEstadia.set('');
    this.custoAlimentacao.set('');
    this.custoEstacionamento.set('');
    this.mostrarExtras.set(false);
  }

  /** Rótulo amigável de cada opção da lista de protocolos. */
  rotuloProtocolo(p: Protocolo): string {
    const titulo = p.titulo?.trim() || p.assunto?.trim() || `Protocolo ${p.id}`;
    const data = p.criadoEm ? new Date(p.criadoEm).toLocaleDateString('pt-BR') : '';
    return `${titulo} — ${p.modulo} · ${p.menu}${data ? ' · ' + data : ''}`;
  }

  /** Bloco de texto com TODOS os campos do atendimento, para copiar de uma vez. */
  private resumoParaColar(): string {
    const linhas = [
      `Cliente: ${this.clienteInfo()}`,
      `Contato: ${this.contato()}`,
      `Início do deslocamento: ${this.inicioDeslocamento()}`,
      `Início da visita: ${this.inicioVisita()}`,
      `Fim da visita: ${this.fimVisita()}`,
      `Fim do deslocamento: ${this.fimDeslocamento()}`,
      `Módulo: ${this.modulo()}`,
      '',
      'Descrição da atividade:',
      this.descricao(),
    ];
    return linhas.join('\n');
  }

  /** "Iniciar preenchimento": cria a visita como RASCUNHO no Portal (via API, com a
   * credencial do consultor) e abre o Portal para ele conferir e enviar ao SICLA. No 1º uso,
   * exige salvar a credencial do Portal antes (obrigatório). */
  async iniciarPreenchimento(): Promise<void> {
    if (this.enviando() || this.salvandoCred()) return;
    if (!this.temCredencial()) {
      this.pedindoCredencial.set(true);
      return;
    }
    await this.enviarAgora();
  }

  /** Salva a credencial do Portal e segue direto para o envio (o consultor não precisa
   * clicar duas vezes). */
  async salvarCredencialEContinuar(): Promise<void> {
    const login = this.formLogin().trim();
    const senha = this.formSenha();
    if (!login || !senha) {
      this.erro.set('Informe o usuário e a senha do Portal Rech.');
      return;
    }
    this.salvandoCred.set(true);
    this.erro.set(null);
    try {
      const c = await this.service.salvarCredencialPortal(login, senha);
      this.temCredencial.set(c.tem);
      this.credLogin.set(c.login);
      this.formSenha.set('');
      this.pedindoCredencial.set(false);
      await this.enviarAgora();
    } catch {
      this.erro.set('Não foi possível salvar a credencial do Portal.');
    } finally {
      this.salvandoCred.set(false);
    }
  }

  /** Reabre a captura da credencial (trocar login/senha do Portal). */
  trocarCredencial(): void {
    this.formLogin.set(this.credLogin());
    this.formSenha.set('');
    this.pedindoCredencial.set(true);
  }

  private numero(valor: string): number | undefined {
    const v = (valor || '').trim();
    if (!v) return undefined;
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }

  private montarPayload(): EnviarVisitaPortalPayload {
    return {
      clienteCodigo: this.clienteCodigo().trim(),
      dataInicioVisita: this.inicioVisita(),
      dataFimVisita: this.fimVisita(),
      dataInicioDeslocamento: this.inicioDeslocamento(),
      dataFimDeslocamento: this.fimDeslocamento(),
      custoPedagio: this.numero(this.custoPedagio()),
      custoEstadia: this.numero(this.custoEstadia()),
      custoAlimentacao: this.numero(this.custoAlimentacao()),
      custoEstacionamento: this.numero(this.custoEstacionamento()),
      kmInicial: this.numero(this.kmInicial()),
      kmFinal: this.numero(this.kmFinal()),
      descricaoAtividade: this.descricao(),
      modulo: this.modulo(),
      contatoNome: this.contato(),
    };
  }

  /** Cria o rascunho no Portal e abre a lista de visitas para o consultor conferir. */
  private async enviarAgora(): Promise<void> {
    const id = this.protocoloSel();
    if (!id) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.visitaCriada.set(null);
    try {
      const r = await this.service.enviarPortal(id, this.montarPayload());
      this.visitaCriada.set(r.visitaId);
      // Sucesso: avisa o pai para fechar o painel e atualizar a página do Portal (o novo
      // rascunho pendente aparece lá). Não abre mais nova guia.
      this.criada.emit(r.visitaId);
    } catch (e: unknown) {
      const err = e as { error?: { precisaCredencial?: boolean; message?: string } };
      if (err?.error?.precisaCredencial) {
        this.temCredencial.set(false);
        this.pedindoCredencial.set(true);
        return;
      }
      this.erro.set(
        err?.error?.message ??
          'Não foi possível criar a visita no Portal Rech. Tente de novo.',
      );
    } finally {
      this.enviando.set(false);
    }
  }

  /** Copia um texto para a área de transferência. Em HTTP puro (produção na 5100) a
   * `navigator.clipboard` não existe — daí o fallback com textarea + execCommand. */
  async copiar(texto: string, chave: string): Promise<void> {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = this.copiarFallback(texto);
    if (ok) {
      this.copiado.set(chave);
      setTimeout(() => {
        if (this.copiado() === chave) this.copiado.set(null);
      }, 1800);
    }
  }

  copiarTudo(): void {
    void this.copiar(this.resumoParaColar(), 'tudo');
  }

  private copiarFallback(texto: string): boolean {
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
