import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LegadoService } from '../../core/services/legado.service';
import { AcaoLegado, ArquivoBaixavel, RoleLegado, getAcao, getRole } from '../../core/models/legado.model';
import { baixarArquivoLegado } from './baixar.util';

@Component({
  selector: 'app-legado-importar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './importar.component.html',
  styleUrl: './importar.component.css',
})
export class ImportarComponent {
  private readonly service = inject(LegadoService);
  private readonly route = inject(ActivatedRoute);

  readonly rid = this.route.snapshot.paramMap.get('rid') ?? '';
  readonly aid = this.route.snapshot.paramMap.get('aid') ?? '';
  readonly role: RoleLegado | undefined = getRole(this.rid);
  readonly acao: AcaoLegado | undefined = getAcao(this.rid, this.aid);

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<{
    ok: boolean;
    erro?: string;
    cliente?: string;
    modulos?: number;
    arquivos: ArquivoBaixavel[];
  } | null>(null);

  async importar(input: HTMLInputElement): Promise<void> {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      this.resultado.set(await this.service.importar(arquivo));
    } catch {
      this.erro.set('Não foi possível importar o Levantamento.');
    } finally {
      this.enviando.set(false);
      input.value = '';
    }
  }

  async baixar(arquivo: ArquivoBaixavel): Promise<void> {
    await baixarArquivoLegado(this.service, arquivo);
  }
}
