import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocConteudoService } from '../../core/services/doc-conteudo.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { ProjetosService } from '../../core/services/projetos.service';
import { baixarArquivo } from '../../core/utils/baixar-arquivo';
import { Projeto } from '../../core/models/projeto.model';
import {
  DocumentoConteudo,
  Secao,
  SecaoTabela,
  camposEditaveis,
  secoes as secoesDoDoc,
  titulo as tituloDoDoc,
  valores as valoresDoDoc,
} from './doc-edit-spec';

@Component({
  selector: 'app-doc-editar',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './doc-editar.component.html',
  styleUrl: './doc-editar.component.css',
})
export class DocEditarComponent {
  private readonly service = inject(DocConteudoService);
  private readonly documentos = inject(DocumentosService);
  private readonly projetos = inject(ProjetosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projetoId = Number(this.route.snapshot.paramMap.get('id'));
  readonly doc = this.route.snapshot.paramMap.get('doc') as DocumentoConteudo;
  readonly docValido = this.doc === 'levantamento' || this.doc === 'projeto';

  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly gerando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly salvo = signal(false);
  readonly projeto = signal<Projeto | null>(null);
  readonly vals = signal<Record<string, string>>({});

  readonly titulo = this.docValido ? tituloDoDoc(this.doc) : '';

  readonly secoes = computed<Secao[]>(() => {
    const p = this.projeto();
    return p && this.docValido ? secoesDoDoc(this.doc, p) : [];
  });

  constructor() {
    if (this.docValido) void this.carregar();
    else this.carregando.set(false);
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const [projeto, conteudo] = await Promise.all([
        this.projetos.buscar(this.projetoId),
        this.service.valores(this.projetoId, this.doc),
      ]);
      this.projeto.set(projeto);
      this.vals.set(valoresDoDoc(this.doc, projeto, conteudo));
    } catch {
      this.erro.set('Não foi possível carregar os dados estruturados.');
    } finally {
      this.carregando.set(false);
    }
  }

  campo(chave: string): string {
    return this.vals()[chave] ?? '';
  }

  linhasTabela(sec: SecaoTabela): number[] {
    return Array.from({ length: sec.linhas }, (_, i) => i);
  }

  chaveTabela(sec: SecaoTabela, linha: number, coluna: string): string {
    return `${sec.prefixo}_${linha}_${coluna}`;
  }

  onCampoChange(chave: string, valor: string): void {
    this.vals.set({ ...this.vals(), [chave]: valor });
    this.salvo.set(false);
  }

  async salvar(): Promise<boolean> {
    const projeto = this.projeto();
    if (!projeto) return false;
    this.salvando.set(true);
    this.erro.set(null);
    try {
      const editaveis = new Set(camposEditaveis(this.doc, projeto));
      const atuais = this.vals();
      const campos: Record<string, string> = {};
      for (const chave of editaveis) campos[chave] = atuais[chave] ?? '';
      await this.service.salvar(this.projetoId, this.doc, campos);
      this.salvo.set(true);
      return true;
    } catch {
      this.erro.set('Não foi possível salvar.');
      return false;
    } finally {
      this.salvando.set(false);
    }
  }

  /**
   * Fecho da etapa 10: grava a revisão e gera o Projeto no layout oficial.
   *
   * Esta tela É o passo 10 (Criação do Projeto) — o GCI entra com tudo herdado da etapa 3,
   * ajusta o que precisa e gera daqui mesmo. A geração é o que conclui o passo no backend
   * (`DocumentosService.PASSO_POR_TIPO`), liberando o passo 11, em que o Administrativo
   * confere e envia ao cliente para assinatura.
   *
   * Salvar ANTES de gerar não é detalhe: sem isso o .docx sairia com a versão anterior dos
   * campos, e o GCI veria na tela um texto diferente do que o cliente recebeu para assinar.
   */
  async salvarEGerar(): Promise<void> {
    if (this.gerando() || this.salvando()) return;
    if (!(await this.salvar())) return;
    this.gerando.set(true);
    this.erro.set(null);
    try {
      const arquivo = await this.documentos.gerarLayout(
        this.projetoId,
        'projeto',
        'auto',
      );
      baixarArquivo(arquivo.blob, arquivo.filename);
      await this.router.navigate(['/projetos', this.projetoId]);
    } catch {
      this.erro.set(
        'Os dados foram salvos, mas não foi possível gerar o Projeto.',
      );
    } finally {
      this.gerando.set(false);
    }
  }
}
