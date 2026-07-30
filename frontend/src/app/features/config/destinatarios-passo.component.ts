import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PassosService } from '../../core/services/passos.service';
import { DestinatarioPassoView } from '../../core/models/passo.model';

/** Quem recebe o e-mail de cada passo do processo — Sistema → Ferramentas.
 *
 * O padrão do código resolve os grupos que o próprio projeto conhece (o GCI designado, os
 * consultores, o contato no cliente). O que não cabe no código são os endereços fixos da
 * Rech: os dois grupos avisados quando um cliente novo é cadastrado (passo 1) são listas
 * internas, mudam sem release e é aqui que entram.
 *
 * Passo nunca configurado mostra o padrão e fica marcado como tal — quem abre a tela vê o
 * que ACONTECE hoje, não um formulário em branco que parece "nada configurado". */
@Component({
  selector: 'app-destinatarios-passo',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './destinatarios-passo.component.html',
})
export class DestinatariosPassoComponent {
  private readonly service = inject(PassosService);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly passos = signal<DestinatarioPassoView[]>([]);
  readonly grupos = signal<{ valor: string; rotulo: string }[]>([]);
  readonly ocupado = signal<number | null>(null);

  /** Passo em edição; `null` = nenhum. Editar um por vez evita salvar sem querer o passo
   * errado numa tela com 15 blocos parecidos. */
  readonly editando = signal<number | null>(null);
  gruposSelecionados: string[] = [];
  extrasTexto = '';
  ativo = true;

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.destinatarios();
      this.passos.set(r.passos);
      this.grupos.set(r.grupos);
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.carregando.set(false);
    }
  }

  rotuloGrupo(valor: string): string {
    return this.grupos().find((g) => g.valor === valor)?.rotulo ?? valor;
  }

  abrir(p: DestinatarioPassoView): void {
    this.editando.set(p.passo);
    this.gruposSelecionados = [...p.grupos];
    this.extrasTexto = p.extras.join('\n');
    this.ativo = p.ativo;
    this.aviso.set(null);
    this.erro.set(null);
  }

  fechar(): void {
    this.editando.set(null);
  }

  alternarGrupo(valor: string, marcado: boolean): void {
    this.gruposSelecionados = marcado
      ? [...new Set([...this.gruposSelecionados, valor])]
      : this.gruposSelecionados.filter((g) => g !== valor);
  }

  async salvar(p: DestinatarioPassoView): Promise<void> {
    this.ocupado.set(p.passo);
    this.erro.set(null);
    try {
      await this.service.salvarDestinatarios(p.passo, {
        grupos: this.gruposSelecionados,
        extras: this.extrasTexto
          .split(/[\n,;]+/)
          .map((e) => e.trim())
          .filter(Boolean),
        ativo: this.ativo,
      });
      this.editando.set(null);
      this.aviso.set(`Destinatários do passo ${p.passo} gravados.`);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
    }
  }

  async restaurar(p: DestinatarioPassoView): Promise<void> {
    this.ocupado.set(p.passo);
    this.erro.set(null);
    try {
      await this.service.restaurarDestinatarios(p.passo);
      this.editando.set(null);
      this.aviso.set(`Passo ${p.passo} voltou ao padrão do sistema.`);
      await this.carregar();
    } catch (e) {
      this.erro.set(this.mensagem(e));
    } finally {
      this.ocupado.set(null);
    }
  }

  private mensagem(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const corpo = e.error as { message?: string } | undefined;
      return corpo?.message ?? `Falha na comunicação (HTTP ${e.status}).`;
    }
    return 'Falha inesperada.';
  }
}
