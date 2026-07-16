import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocumentosService, LevantamentoImportado } from '../../core/services/documentos.service';
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
  readonly gerando = signal<'auto' | 'modelo' | 'importar' | 'importado' | null>(null);
  readonly cliente = signal('');
  readonly telaResp = signal(0);
  readonly total = signal(0);
  readonly importado = signal<LevantamentoImportado | null>(null);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [projeto, dados, origem] = await Promise.all([
        this.projetos.buscar(this.projetoId),
        this.levantamentoService.obter(this.projetoId),
        this.documentosService.origemProjeto(this.projetoId),
      ]);
      this.cliente.set(projeto.cliente);
      this.telaResp.set(dados.resumo.respondidas);
      this.total.set(dados.resumo.total);
      this.importado.set(origem.importado);
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

  async importarEGerar(arquivo: File | null, origem: 'importar' | 'importado'): Promise<void> {
    if (this.gerando()) return;
    this.gerando.set(origem);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const resultado = await this.documentosService.importarLevantamentoEGerarProjeto(this.projetoId, arquivo);
      baixarNoNavegador(resultado.blob, resultado.filename);
      const fonte = origem === 'importar' ? 'do Levantamento enviado' : 'do Levantamento importado';
      this.aviso.set(`Importadas ${resultado.respostasImportadas} resposta(s) ${fonte}; Projeto gerado.`);
      await this.router.navigate(['/projetos', this.projetoId]);
    } catch {
      this.erro.set('Não foi possível importar o Levantamento e gerar o Projeto.');
    } finally {
      this.gerando.set(null);
    }
  }

  async importarArquivo(input: HTMLInputElement): Promise<void> {
    const arquivo = input.files?.[0];
    if (!arquivo) {
      this.erro.set('Selecione o arquivo .docx do Levantamento.');
      return;
    }
    if (!arquivo.name.toLowerCase().endsWith('.docx')) {
      this.erro.set('O Levantamento importado deve ser um arquivo .docx.');
      return;
    }
    await this.importarEGerar(arquivo, 'importar');
    input.value = '';
  }

  async usarImportado(): Promise<void> {
    await this.importarEGerar(null, 'importado');
  }
}
