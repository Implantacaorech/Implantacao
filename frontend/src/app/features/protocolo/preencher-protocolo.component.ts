import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProtocoloService } from '../../core/services/protocolo.service';
import {
  ClienteComProtocolo,
  Protocolo,
  RascunhoVisita,
} from '../../core/models/protocolo.model';

/** Status de protocolo que já têm conteúdo aproveitável para o rascunho — os em andamento
 * (gravando/transcrevendo/analisando/pendente) e os que deram erro ficam de fora. */
const STATUS_COM_CONTEUDO = new Set<string>([
  'Em revisão',
  'Aprovado',
  'Reprovado / Ajustar',
]);

/** Painel "Preencher protocolo": escolhe um cliente e uma transcrição/gravação dele e monta
 * o rascunho do "Registro de Atendimento em Visita" do Portal Rech, pronto para colar. Toda
 * a fala com a API passa pelo `ProtocoloService` (o componente não fala HTTP direto). */
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

  constructor() {
    void this.carregarClientes();
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
      this.rascunho.set(await this.service.rascunhoVisita(id));
    } catch {
      this.erro.set('Não foi possível montar o rascunho deste protocolo.');
    } finally {
      this.carregandoRascunho.set(false);
    }
  }

  /** Rótulo amigável de cada opção da lista de protocolos. */
  rotuloProtocolo(p: Protocolo): string {
    const titulo = p.titulo?.trim() || p.assunto?.trim() || `Protocolo ${p.id}`;
    const data = p.criadoEm ? new Date(p.criadoEm).toLocaleDateString('pt-BR') : '';
    return `${titulo} — ${p.modulo} · ${p.menu}${data ? ' · ' + data : ''}`;
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
