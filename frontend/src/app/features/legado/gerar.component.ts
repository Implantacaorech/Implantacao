import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LegadoService } from '../../core/services/legado.service';
import { LegadoClienteEstadoService } from '../../core/services/legado-cliente-estado.service';
import { AcaoLegado, ArquivoBaixavel, RoleLegado, getAcao, getRole, usaCliente } from '../../core/models/legado.model';
import { baixarArquivoLegado } from './baixar.util';

@Component({
  selector: 'app-legado-gerar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './gerar.component.html',
  styleUrl: './gerar.component.css',
})
export class GerarComponent {
  private readonly service = inject(LegadoService);
  private readonly clienteEstado = inject(LegadoClienteEstadoService);
  private readonly route = inject(ActivatedRoute);

  readonly rid = this.route.snapshot.paramMap.get('rid') ?? '';
  readonly aid = this.route.snapshot.paramMap.get('aid') ?? '';
  readonly role: RoleLegado | undefined = getRole(this.rid);
  readonly acao: AcaoLegado | undefined = getAcao(this.rid, this.aid);
  readonly precisaCliente = this.acao ? usaCliente(this.acao) : false;
  readonly clienteAtual = this.clienteEstado.atual;

  readonly gerando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<{ ok: boolean; erro?: string; arquivo?: ArquivoBaixavel } | null>(null);

  arquivoYaml: File | null = null;

  onYamlSelecionado(input: HTMLInputElement): void {
    this.arquivoYaml = input.files?.[0] ?? null;
  }

  async gerar(): Promise<void> {
    if (!this.acao?.mod) return;
    this.gerando.set(true);
    this.erro.set(null);
    try {
      const clienteArquivo = this.precisaCliente ? this.clienteAtual()?.arquivo : undefined;
      this.resultado.set(await this.service.gerar(this.acao.mod, this.arquivoYaml, clienteArquivo));
    } catch {
      this.erro.set('Não foi possível gerar o documento.');
    } finally {
      this.gerando.set(false);
    }
  }

  async baixar(arquivo: ArquivoBaixavel): Promise<void> {
    await baixarArquivoLegado(this.service, arquivo);
  }
}
