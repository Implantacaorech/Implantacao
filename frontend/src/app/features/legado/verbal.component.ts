import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LegadoService } from '../../core/services/legado.service';
import { AcaoLegado, RoleLegado, getRole } from '../../core/models/legado.model';
import { baixarArquivoLegado } from './baixar.util';

@Component({
  selector: 'app-legado-verbal',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './verbal.component.html',
  styleUrl: './verbal.component.css',
})
export class VerbalComponent {
  private readonly service = inject(LegadoService);
  private readonly route = inject(ActivatedRoute);

  readonly rid = this.route.snapshot.paramMap.get('rid') ?? '';
  readonly role: RoleLegado | undefined = getRole(this.rid);
  readonly acao: AcaoLegado | undefined = this.role?.acoes.find((a) => a.tipo === 'verbal');

  readonly convertendoTexto = signal(false);
  readonly convertendoDocx = signal(false);
  readonly erro = signal<string | null>(null);
  readonly arquivoCorrigido = signal<{ token: string; rotulo: string; nome: string } | null>(null);
  readonly depois = signal<string | null>(null);
  readonly mudancas = signal<[string, string][]>([]);
  readonly iaAtiva = signal(false);
  readonly iaModelo = signal('');

  texto = '';

  constructor() {
    void this.service.iaStatus().then((r) => {
      this.iaAtiva.set(r.ativa);
      this.iaModelo.set(r.modelo);
    });
  }

  async converterTexto(): Promise<void> {
    if (!this.texto.trim()) return;
    this.convertendoTexto.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.converterVerbalTexto(this.texto);
      this.depois.set(r.depois);
      this.mudancas.set(r.mudancas);
    } catch {
      this.erro.set('Não foi possível converter o texto.');
    } finally {
      this.convertendoTexto.set(false);
    }
  }

  async converterDocx(input: HTMLInputElement): Promise<void> {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    this.convertendoDocx.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.converterVerbalDocx(arquivo);
      this.arquivoCorrigido.set(r);
      input.value = '';
    } catch {
      this.erro.set('Não foi possível corrigir o documento.');
    } finally {
      this.convertendoDocx.set(false);
    }
  }

  async baixar(): Promise<void> {
    const arquivo = this.arquivoCorrigido();
    if (arquivo) await baixarArquivoLegado(this.service, arquivo);
  }
}
