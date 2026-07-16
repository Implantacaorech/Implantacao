import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AtividadeService } from '../../core/services/atividade.service';
import { PainelAtividade } from '../../core/models/atividade.model';

const ICONE_EVENTO: Record<string, string> = {
  nota: '#ic-pencil',
  etapa: '#ic-arrow-right',
  documento: '#ic-file',
  email: '#ic-mail',
  alerta: '#ic-bell',
};

@Component({
  selector: 'app-atividade',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './atividade.component.html',
  styleUrl: './atividade.component.css',
})
export class AtividadeComponent {
  private readonly service = inject(AtividadeService);

  readonly iconeEvento = ICONE_EVENTO;

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly dados = signal<PainelAtividade | null>(null);

  readonly maxFunil = computed(() => Math.max(1, ...(this.dados()?.funil.map((f) => f.n) ?? [1])));

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.dados.set(await this.service.atividade());
    } catch {
      this.erro.set('Não foi possível carregar a Atividade da operação.');
    } finally {
      this.carregando.set(false);
    }
  }
}
