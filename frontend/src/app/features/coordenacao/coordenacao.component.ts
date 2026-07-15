import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CoordenacaoService } from '../../core/services/coordenacao.service';
import { PainelCoordenacao } from '../../core/models/coordenacao.model';

@Component({
  selector: 'app-coordenacao',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './coordenacao.component.html',
  styleUrl: './coordenacao.component.css',
})
export class CoordenacaoComponent {
  private readonly service = inject(CoordenacaoService);

  readonly carregando = signal(true);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly dados = signal<PainelCoordenacao | null>(null);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.dados.set(await this.service.coordenacao());
    } catch {
      this.erro.set('Não foi possível carregar o Painel de Coordenação.');
    } finally {
      this.carregando.set(false);
    }
  }

  async enviarDigest(): Promise<void> {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const r = await this.service.enviarDigest();
      if (r.ok) this.aviso.set(r.mensagem);
      else this.erro.set(r.mensagem);
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível enviar o resumo.',
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
