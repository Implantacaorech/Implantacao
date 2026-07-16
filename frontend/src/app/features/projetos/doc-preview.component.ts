import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DocumentosService } from '../../core/services/documentos.service';
import { Documento } from '../../core/models/documento.model';

function baixarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'app-doc-preview',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './doc-preview.component.html',
  styleUrl: './doc-preview.component.css',
})
export class DocPreviewComponent implements OnDestroy {
  private readonly service = inject(DocumentosService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private objectUrlAtual: string | null = null;
  private blobPdf: Blob | null = null;

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));
  readonly docId = Number(this.route.snapshot.paramMap.get('docId'));
  readonly documento = (history.state as { documento?: Documento } | undefined)?.documento ?? null;

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly modo = signal<'pdf' | 'html' | null>(null);
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  readonly htmlSeguro = signal<SafeHtml | null>(null);

  constructor() {
    void this.carregar();
  }

  ngOnDestroy(): void {
    if (this.objectUrlAtual) URL.revokeObjectURL(this.objectUrlAtual);
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.preview(this.docId);
      if (r.tipo === 'pdf') {
        this.blobPdf = r.blob;
        const url = URL.createObjectURL(r.blob);
        this.objectUrlAtual = url;
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.modo.set('pdf');
      } else {
        this.htmlSeguro.set(this.sanitizer.bypassSecurityTrustHtml(r.html));
        this.modo.set('html');
      }
    } catch {
      this.erro.set('Não foi possível pré-visualizar este documento.');
    } finally {
      this.carregando.set(false);
    }
  }

  async baixar(): Promise<void> {
    const nomeSugerido = this.documento?.arquivo ?? 'documento';
    if (this.blobPdf) {
      baixarBlob(this.blobPdf, nomeSugerido);
      return;
    }
    const arquivo = await this.service.baixar(this.docId, nomeSugerido);
    baixarBlob(arquivo.blob, arquivo.filename);
  }
}
