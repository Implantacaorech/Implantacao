import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DicionarioService } from '../../core/services/dicionario.service';
import { DocumentoDetalhe, SecaoDocumento } from '../../core/models/dicionario.model';

const ROTULO_CATEGORIA: Record<string, string> = {
  identificacao: 'Identificação',
  configuracao: 'Configurações',
  rotina: 'Rotinas / Menu',
  dependencia: 'Dependências',
  suporte: 'Suporte / Erros',
  checklist: 'Checklist',
  'palavras-chave': 'Palavras-chave',
  geral: 'Geral',
};

/** Documento completo do Dicionário: cabeçalho + seções classificadas + fonte citável.
 * Renderiza o corpo de cada seção como texto (com quebras preservadas) — sem innerHTML,
 * então não há risco de injeção a partir do conteúdo do documento. */
@Component({
  selector: 'app-dicionario-documento',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './dicionario-documento.component.html',
  styleUrl: './dicionario-documento.component.css',
})
export class DicionarioDocumentoComponent {
  private readonly service = inject(DicionarioService);
  private readonly route = inject(ActivatedRoute);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly doc = signal<DocumentoDetalhe | null>(null);

  readonly secoesVisiveis = computed<SecaoDocumento[]>(() =>
    (this.doc()?.secoes ?? []).filter((s) => s.corpo.trim().length > 0),
  );

  constructor() {
    void this.carregar();
  }

  rotulo(categoria: string): string {
    return ROTULO_CATEGORIA[categoria] ?? 'Geral';
  }

  private async carregar(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.erro.set('Documento não informado.');
      this.carregando.set(false);
      return;
    }
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.doc.set(await this.service.documento(slug));
    } catch {
      this.erro.set('Documento não encontrado no Dicionário.');
    } finally {
      this.carregando.set(false);
    }
  }
}
