import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ArquivoBaixado, DocumentosService } from '../../core/services/documentos.service';
import { Documento, EventoProjeto, SLUGS_DOCUMENTO_FIEL, SlugDocumentoFiel } from '../../core/models/documento.model';

function baixarNoNavegador(arquivo: ArquivoBaixado): void {
  const url = URL.createObjectURL(arquivo.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'app-documentos-projeto',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './documentos-projeto.component.html',
  styleUrl: './documentos-projeto.component.css',
})
export class DocumentosProjetoComponent {
  private readonly service = inject(DocumentosService);
  private readonly route = inject(ActivatedRoute);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));
  readonly slugs = SLUGS_DOCUMENTO_FIEL;

  readonly carregando = signal(true);
  readonly gerando = signal<SlugDocumentoFiel | null>(null);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly documentos = signal<Documento[]>([]);
  readonly eventos = signal<EventoProjeto[]>([]);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [documentos, eventos] = await Promise.all([
        this.service.listar(this.projetoId),
        this.service.eventos(this.projetoId),
      ]);
      this.documentos.set(documentos);
      this.eventos.set(eventos);
    } catch {
      this.erro.set('Não foi possível carregar os documentos do projeto.');
    } finally {
      this.carregando.set(false);
    }
  }

  async gerar(slug: SlugDocumentoFiel, modo?: 'modelo'): Promise<void> {
    if (this.gerando()) return;
    this.gerando.set(slug);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const arquivo = await this.service.gerarLayout(this.projetoId, slug, modo);
      baixarNoNavegador(arquivo);
      this.aviso.set(`${arquivo.filename} gerado e anexado à ficha do projeto.`);
      await this.carregar();
    } catch (e) {
      this.erro.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : `Não foi possível gerar o documento.`,
      );
    } finally {
      this.gerando.set(null);
    }
  }

  async baixarExistente(doc: Documento): Promise<void> {
    try {
      const arquivo = await this.service.baixar(doc.id, doc.arquivo);
      baixarNoNavegador(arquivo);
    } catch {
      this.erro.set('Não foi possível baixar o documento.');
    }
  }
}
