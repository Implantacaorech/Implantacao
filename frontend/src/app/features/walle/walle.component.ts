import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PermissoesService } from '../../core/services/permissoes.service';
import { WalleService } from '../../core/services/walle.service';
import {
  ArquivoWalle,
  RespostaBuscaWalle,
  RespostaIaWalle,
  StatusAcervoWalle,
  VisaoChatWalle,
} from '../../core/models/walle.model';

/** Execução → Wall-e: base de conhecimento pesquisável sobre o acervo documental dos chats
 * do bot Wall-e (técnico 900 do SICLA). A tela pesquisa o ÍNDICE no banco do Painel — a
 * fonte (`R:\GRM\CHAT_WALLE\`) é somente leitura e nunca é tocada daqui. Dois caminhos:
 * "Pesquisar" (busca híbrida, sem IA) e "Perguntar" (busca + síntese pela IA local, que
 * degrada para busca-guiada quando não configurada). */
@Component({
  selector: 'app-walle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './walle.component.html',
  styleUrl: './walle.component.css',
})
export class WalleComponent {
  private readonly service = inject(WalleService);
  private readonly perm = inject(PermissoesService);

  readonly q = signal('');
  readonly categoria = signal('');
  readonly origem = signal('');
  readonly chatFiltro = signal('');

  readonly carregando = signal(false);
  readonly atualizando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly status = signal<StatusAcervoWalle | null>(null);
  readonly busca = signal<RespostaBuscaWalle | null>(null);
  readonly respostaIa = signal<RespostaIaWalle | null>(null);
  readonly chatAberto = signal<VisaoChatWalle | null>(null);
  readonly arquivoAberto = signal<ArquivoWalle | null>(null);
  readonly imagemUrl = signal<string | null>(null);

  readonly podeAtualizar = computed(() => this.perm.podeAlterar('walle'));
  readonly temFiltro = computed(
    () =>
      this.q() !== '' ||
      this.categoria() !== '' ||
      this.origem() !== '' ||
      this.chatFiltro() !== '',
  );
  readonly chatsDoAcervo = computed(() => {
    const b = this.busca();
    if (!b) return [];
    return [...new Set(b.resultados.map((r) => r.chat))].sort((a, z) => a - z);
  });

  constructor() {
    void this.carregarStatus();
    void this.pesquisar();
  }

  async carregarStatus(): Promise<void> {
    try {
      this.status.set(await this.service.status());
    } catch {
      this.status.set(null); // status é informativo — a busca segue funcionando sem ele
    }
  }

  /** Busca híbrida (sem IA). Sem termos, navega pelos documentos mais recentes. */
  async pesquisar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.respostaIa.set(null);
    try {
      this.busca.set(
        await this.service.pesquisar({
          q: this.q() || undefined,
          categoria: this.categoria() || undefined,
          origem: this.origem() || undefined,
          chat: this.chatFiltro() === '' ? undefined : Number(this.chatFiltro()),
        }),
      );
    } catch {
      this.erro.set('Não foi possível consultar o acervo. Tente novamente.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Pergunta em linguagem natural: busca + síntese pela IA local (com degradação). */
  async perguntar(): Promise<void> {
    if (this.q().trim() === '') return;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.perguntar(this.q().trim());
      this.respostaIa.set(r);
      this.busca.set(r.busca);
    } catch {
      this.erro.set('Não foi possível consultar a IA. A busca simples continua disponível.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Assunto/sugestão clicável (§15/§40): vira nova pesquisa contextualizada. */
  async pesquisarAssunto(assunto: string): Promise<void> {
    this.q.set(assunto);
    await this.pesquisar();
  }

  async limparFiltros(): Promise<void> {
    this.q.set('');
    this.categoria.set('');
    this.origem.set('');
    this.chatFiltro.set('');
    await this.pesquisar();
  }

  async atualizarAcervo(): Promise<void> {
    this.atualizando.set(true);
    this.erro.set(null);
    try {
      this.status.set(await this.service.atualizar());
      await this.pesquisar();
    } catch {
      this.erro.set('A atualização do acervo falhou. Verifique o acesso ao share e tente de novo.');
    } finally {
      this.atualizando.set(false);
    }
  }

  async abrirChat(codigo: number): Promise<void> {
    this.erro.set(null);
    try {
      this.chatAberto.set(await this.service.visaoChat(codigo));
      this.arquivoAberto.set(null);
    } catch {
      this.erro.set(`Não foi possível abrir o chat ${codigo}.`);
    }
  }

  fecharChat(): void {
    this.chatAberto.set(null);
  }

  async abrirArquivo(id: number): Promise<void> {
    this.erro.set(null);
    this.liberarImagem();
    try {
      const a = await this.service.arquivo(id);
      this.arquivoAberto.set(a);
      if (a.categoria === 'imagem') {
        const blob = await this.service.imagem(id);
        this.imagemUrl.set(URL.createObjectURL(blob));
      }
    } catch {
      this.erro.set('Não foi possível abrir o documento.');
    }
  }

  fecharArquivo(): void {
    this.arquivoAberto.set(null);
    this.liberarImagem();
  }

  private liberarImagem(): void {
    const url = this.imagemUrl();
    if (url) URL.revokeObjectURL(url);
    this.imagemUrl.set(null);
  }

  rotuloConfianca(c: string): string {
    return c === 'alta' ? 'Alta' : c === 'media' ? 'Média' : 'Baixa';
  }
}
