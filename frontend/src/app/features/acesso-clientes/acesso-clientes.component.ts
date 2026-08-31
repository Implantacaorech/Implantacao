import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ContatoSicla } from '../../core/models/contato-sicla.model';
import { ContatosSiclaService } from '../../core/services/contatos-sicla.service';

/** **Acesso de Clientes** (Sistema, só ADM): quem, do lado do cliente, entra no Painel.
 *
 * A lista vem de `SICLA.LISTA_CONTATOS` filtrada por `PORTAL_RECH_CLIENTES = 1` — ou seja,
 * **quem autoriza é o SICLA**, não esta tela. O que se faz aqui é dar (ou tirar) a CONTA no
 * Painel de quem já está autorizado lá.
 *
 * Espelha a seção "Técnicos do SICLA" da tela de Usuários, a pedido do usuário: mesma
 * mecânica de "Buscar no SICLA" e "Buscar novos", com seleção por linha. */
@Component({
  selector: 'app-acesso-clientes',
  standalone: true,
  templateUrl: './acesso-clientes.component.html',
  styleUrls: ['./acesso-clientes.component.css'],
})
export class AcessoClientesComponent {
  private readonly service = inject(ContatosSiclaService);

  readonly cliente = signal('');
  readonly filtro = signal('');
  readonly soNaoLiberados = signal(false);
  readonly contatos = signal<ContatoSicla[]>([]);
  readonly selecionados = signal<string[]>([]);
  readonly carregando = signal(false);
  readonly agindo = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly ignorados = signal<
    { nome: string; email: string; motivo: string }[]
  >([]);
  /** A busca já foi feita? Separa "nada encontrado" de "ainda não buscou". */
  readonly buscou = signal(false);

  readonly liberadosNaLista = computed(
    () => this.contatos().filter((c) => c.jaLiberado).length,
  );

  marcado(email: string): boolean {
    return this.selecionados().includes(email);
  }

  alternar(email: string, marcado: boolean): void {
    this.selecionados.update((atual) =>
      marcado
        ? [...new Set([...atual, email])]
        : atual.filter((e) => e !== email),
    );
  }

  marcarTodos(marcado: boolean): void {
    this.selecionados.set(
      marcado ? this.contatos().map((c) => c.email).filter(Boolean) : [],
    );
  }

  async buscar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    this.ignorados.set([]);
    try {
      const r = await this.service.listar(
        this.cliente(),
        this.filtro(),
        this.soNaoLiberados(),
      );
      this.contatos.set(r.contatos);
      this.selecionados.set([]);
      this.buscou.set(true);
      // `ok:false` é a conexão com o SICLA indisponível — a tela avisa e não finge lista
      // vazia, que pareceria "este cliente não tem contato liberado".
      if (!r.ok) this.erro.set(r.mensagem);
    } catch (e) {
      this.erro.set(this.mensagemDe(e));
    } finally {
      this.carregando.set(false);
    }
  }

  /** "Buscar novos": só quem ainda não tem acesso — o caso do dia a dia. */
  async buscarNovos(): Promise<void> {
    this.soNaoLiberados.set(true);
    await this.buscar();
  }

  async alternarSoNaoLiberados(valor: boolean): Promise<void> {
    this.soNaoLiberados.set(valor);
    if (this.buscou()) await this.buscar();
  }

  async liberar(): Promise<void> {
    const alvo = this.selecionados().length
      ? this.selecionados()
      : this.contatos().filter((c) => !c.jaLiberado).map((c) => c.email);
    if (!alvo.length) {
      this.erro.set('Nenhum contato a liberar.');
      return;
    }
    this.agindo.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const r = await this.service.liberar(this.cliente(), alvo);
      this.ignorados.set(r.ignorados ?? []);
      if (r.ok) {
        this.aviso.set(
          `${r.mensagem} O contato define a senha pelo "Esqueci minha senha" da tela de login.`,
        );
        await this.buscar();
      } else {
        this.erro.set(r.mensagem);
      }
    } catch (e) {
      this.erro.set(this.mensagemDe(e));
    } finally {
      this.agindo.set(false);
    }
  }

  async revogar(): Promise<void> {
    const alvo = this.selecionados();
    if (!alvo.length) {
      this.erro.set('Marque quem deve perder o acesso.');
      return;
    }
    this.agindo.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const r = await this.service.revogar(alvo);
      this.aviso.set(r.mensagem);
      await this.buscar();
    } catch (e) {
      this.erro.set(this.mensagemDe(e));
    } finally {
      this.agindo.set(false);
    }
  }

  private mensagemDe(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const corpo = e.error as { message?: string } | undefined;
      return corpo?.message ?? `Falha na requisição (HTTP ${e.status}).`;
    }
    return e instanceof Error ? e.message : String(e);
  }
}
