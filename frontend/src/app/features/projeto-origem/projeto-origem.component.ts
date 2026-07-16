import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocumentosService } from '../../core/services/documentos.service';
import { LevantamentoService } from '../../core/services/levantamento.service';
import { ProjetosService } from '../../core/services/projetos.service';

function baixarNoNavegador(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'app-projeto-origem',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './projeto-origem.component.html',
  styleUrl: './projeto-origem.component.css',
})
export class ProjetoOrigemComponent {
  private readonly documentosService = inject(DocumentosService);
  private readonly levantamentoService = inject(LevantamentoService);
  private readonly projetos = inject(ProjetosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly gerando = signal<'auto' | 'modelo' | null>(null);
  readonly cliente = signal('');
  readonly telaResp = signal(0);
  readonly total = signal(0);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [projeto, dados] = await Promise.all([
        this.projetos.buscar(this.projetoId),
        this.levantamentoService.obter(this.projetoId),
      ]);
      this.cliente.set(projeto.cliente);
      this.telaResp.set(dados.resumo.respondidas);
      this.total.set(dados.resumo.total);
    } catch {
      this.erro.set('Não foi possível carregar os dados do Levantamento.');
    } finally {
      this.carregando.set(false);
    }
  }

  async gerar(modo: 'auto' | 'modelo'): Promise<void> {
    if (this.gerando()) return;
    this.gerando.set(modo);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const arquivo = await this.documentosService.gerarLayout(this.projetoId, 'projeto', modo);
      baixarNoNavegador(arquivo.blob, arquivo.filename);
      await this.router.navigate(['/projetos', this.projetoId]);
    } catch {
      this.erro.set('Não foi possível gerar o Projeto.');
    } finally {
      this.gerando.set(null);
    }
  }
}
