import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatrizService } from '../../core/services/matriz.service';
import { MatrizArea, MatrizTecnico } from '../../core/models/matriz.model';

@Component({
  selector: 'app-matriz-ficha',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './matriz-ficha.component.html',
  styleUrl: './matriz-ficha.component.css',
})
export class MatrizFichaComponent {
  private readonly service = inject(MatrizService);
  private readonly route = inject(ActivatedRoute);

  readonly tecnicoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly tecnico = signal<MatrizTecnico | null>(null);
  readonly areas = signal<MatrizArea[]>([]);
  readonly editavel = signal(false);
  readonly volta = signal(false);
  readonly setor = signal('');
  readonly dias = signal('');
  readonly notas = signal<Record<string, string>>({});

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const view = await this.service.ficha(this.tecnicoId);
      this.tecnico.set(view.tecnico);
      this.areas.set(view.areas);
      this.editavel.set(view.editavel);
      this.volta.set(view.volta);
      this.setor.set(view.tecnico.setor);
      this.dias.set(view.tecnico.dias);
      this.notas.set(
        Object.fromEntries(Object.entries(view.notas).map(([sigla, nota]) => [sigla, String(nota)])),
      );
    } catch {
      this.erro.set('Não foi possível carregar a ficha.');
    } finally {
      this.carregando.set(false);
    }
  }

  nota(sigla: string): string {
    return this.notas()[sigla] ?? '';
  }

  atualizarNota(sigla: string, valor: string): void {
    this.notas.set({ ...this.notas(), [sigla]: valor });
  }

  async salvar(): Promise<void> {
    if (this.salvando() || !this.editavel()) return;
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      await this.service.salvar(this.tecnicoId, {
        setor: this.setor(),
        dias: this.dias(),
        notas: this.notas(),
      });
      this.aviso.set('Ficha salva.');
      await this.carregar();
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Não foi possível salvar a ficha.',
      );
    } finally {
      this.salvando.set(false);
    }
  }
}
