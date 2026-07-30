import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CadastrosService } from '../../core/services/cadastros.service';
import {
  ChecklistModeloLinha,
  IndiceTopicoLinha,
  ModeloDocumento,
  ModeloDocumentoCampo,
  ModeloDocumentoVersao,
  campoVazio,
  checklistVazio,
  indiceVazio,
} from '../../core/models/cadastros.model';
import { deSignal, filtrosSalvos } from '../../core/utils/filtros-salvos';

type Aba = 'checklist' | 'indice' | 'modelos';

function baixarNoNavegador(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Component({
  selector: 'app-cadastros',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './cadastros.component.html',
  styleUrl: './cadastros.component.css',
})
export class CadastrosComponent {
  private readonly service = inject(CadastrosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly aba = signal<Aba>('checklist');
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  // --- Check List ----------------------------------------------------------------
  readonly clCarregando = signal(true);
  readonly clLinhas = signal<ChecklistModeloLinha[]>([]);
  readonly clModulos = signal<string[]>([]);
  readonly clFiltroModulo = signal('');
  readonly clFiltroBusca = signal('');
  readonly clEmEdicao = signal<ChecklistModeloLinha | null>(null);
  readonly clSalvando = signal(false);
  readonly clReimportando = signal(false);
  readonly clPagina = signal(1);
  readonly clTotal = signal(0);
  readonly clPorPagina = 50;

  // --- Índice de Tópicos -----------------------------------------------------------
  readonly idCarregando = signal(true);
  readonly idLinhas = signal<IndiceTopicoLinha[]>([]);
  readonly idModulos = signal<string[]>([]);
  readonly idFiltroModulo = signal('');
  readonly idFiltroBusca = signal('');
  readonly idEmEdicao = signal<IndiceTopicoLinha | null>(null);
  readonly idSalvando = signal(false);
  readonly idReimportando = signal(false);
  readonly idTotal = signal(0);

  // --- Modelos de Documentos ---------------------------------------------------------
  readonly mdCarregando = signal(true);
  readonly mdLista = signal<ModeloDocumento[]>([]);
  readonly mdSelecionado = signal<ModeloDocumento | null>(null);
  readonly mdVersoes = signal<ModeloDocumentoVersao[]>([]);
  readonly mdCampos = signal<ModeloDocumentoCampo[]>([]);
  readonly mdEnviando = signal(false);
  readonly mdMotivoVersao = signal('');
  readonly mdCampoEmEdicao = signal<ModeloDocumentoCampo | null>(null);
  readonly mdCampoSalvando = signal(false);

  constructor() {
    // Filtros das abas Check List e Índice de Tópicos, salvos por usuário logado. A ABA em si
    // fica fora: quem manda nela é a rota (`/cadastros/:aba`), que é o link compartilhado.
    filtrosSalvos(
      'cadastros',
      {
        clFiltroModulo: deSignal(this.clFiltroModulo),
        clFiltroBusca: deSignal(this.clFiltroBusca),
        idFiltroModulo: deSignal(this.idFiltroModulo),
        idFiltroBusca: deSignal(this.idFiltroBusca),
      },
      { aoRestaurar: () => this.carregarAbaAtual() },
    );
    const abaRota = this.route.snapshot.paramMap.get('aba') as Aba | null;
    if (abaRota === 'indice' || abaRota === 'modelos') this.aba.set(abaRota);
    this.carregarAbaAtual();
  }

  private carregarAbaAtual(): void {
    const a = this.aba();
    if (a === 'checklist') void this.carregarChecklist();
    if (a === 'indice') void this.carregarIndice();
    if (a === 'modelos') void this.carregarModelos();
  }

  async selecionarAba(a: Aba): Promise<void> {
    this.aba.set(a);
    this.erro.set(null);
    this.aviso.set(null);
    this.carregarAbaAtual();
    await this.router.navigate(['/cadastros', a]).catch(() => undefined);
  }

  private mensagemErro(e: unknown, padrao: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : padrao;
  }

  // === Check List ===================================================================

  async carregarChecklist(): Promise<void> {
    this.clCarregando.set(true);
    this.erro.set(null);
    try {
      const { linhas, total, modulos } = await this.service.checklistListar({
        mod: this.clFiltroModulo(),
        q: this.clFiltroBusca(),
        offset: (this.clPagina() - 1) * this.clPorPagina,
        limite: this.clPorPagina,
      });
      this.clLinhas.set(linhas);
      this.clTotal.set(total);
      this.clModulos.set(modulos);
    } catch {
      this.erro.set('Não foi possível carregar o catálogo de Check List.');
    } finally {
      this.clCarregando.set(false);
    }
  }

  clTotalPaginas(): number {
    return Math.max(1, Math.ceil(this.clTotal() / this.clPorPagina));
  }

  clIrParaPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.clTotalPaginas()) return;
    this.clPagina.set(pagina);
    void this.carregarChecklist();
  }

  clFiltrar(): void {
    this.clPagina.set(1);
    void this.carregarChecklist();
  }

  clLimparFiltro(): void {
    this.clFiltroModulo.set('');
    this.clFiltroBusca.set('');
    this.clPagina.set(1);
    void this.carregarChecklist();
  }

  clEditar(linha: ChecklistModeloLinha): void {
    this.clEmEdicao.set({ ...linha });
  }

  clNova(): void {
    this.clEmEdicao.set(checklistVazio());
  }

  clCancelar(): void {
    this.clEmEdicao.set(null);
  }

  async clSalvar(): Promise<void> {
    const linha = this.clEmEdicao();
    if (!linha || this.clSalvando()) return;
    this.clSalvando.set(true);
    this.erro.set(null);
    try {
      await this.service.checklistSalvar(linha);
      this.clEmEdicao.set(null);
      this.aviso.set('Linha salva.');
      await this.carregarChecklist();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar a linha.'));
    } finally {
      this.clSalvando.set(false);
    }
  }

  async clExcluir(id: number | undefined): Promise<void> {
    if (!id) return;
    if (!confirm('Excluir esta linha do catálogo?')) return;
    try {
      await this.service.checklistExcluir(id);
      await this.carregarChecklist();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível excluir a linha.'));
    }
  }

  async clReimportar(): Promise<void> {
    if (this.clReimportando()) return;
    if (!confirm('Isso substitui TODO o catálogo pelo modelo (tools/data/checklist_modulos.yaml). Continuar?'))
      return;
    this.clReimportando.set(true);
    this.erro.set(null);
    try {
      const n = await this.service.checklistReimportar();
      this.aviso.set(`Catálogo reimportado (${n} linhas).`);
      await this.carregarChecklist();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível reimportar o catálogo.'));
    } finally {
      this.clReimportando.set(false);
    }
  }

  // === Índice de Tópicos ==============================================================

  async carregarIndice(): Promise<void> {
    this.idCarregando.set(true);
    this.erro.set(null);
    try {
      const { linhas, total, modulos } = await this.service.indiceListar({
        mod: this.idFiltroModulo(),
        q: this.idFiltroBusca(),
      });
      this.idLinhas.set(linhas);
      this.idTotal.set(total);
      this.idModulos.set(modulos);
    } catch {
      this.erro.set('Não foi possível carregar o Índice de Tópicos.');
    } finally {
      this.idCarregando.set(false);
    }
  }

  idLimparFiltro(): void {
    this.idFiltroModulo.set('');
    this.idFiltroBusca.set('');
    void this.carregarIndice();
  }

  idEditar(linha: IndiceTopicoLinha): void {
    this.idEmEdicao.set({ ...linha });
  }

  idNovo(): void {
    this.idEmEdicao.set(indiceVazio());
  }

  idCancelar(): void {
    this.idEmEdicao.set(null);
  }

  async idSalvar(): Promise<void> {
    const linha = this.idEmEdicao();
    if (!linha || this.idSalvando()) return;
    this.idSalvando.set(true);
    this.erro.set(null);
    try {
      await this.service.indiceSalvar(linha);
      this.idEmEdicao.set(null);
      this.aviso.set('Tópico salvo.');
      await this.carregarIndice();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar o tópico.'));
    } finally {
      this.idSalvando.set(false);
    }
  }

  async idExcluir(id: number | undefined): Promise<void> {
    if (!id) return;
    if (!confirm('Excluir este tópico do índice?')) return;
    try {
      await this.service.indiceExcluir(id);
      await this.carregarIndice();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível excluir o tópico.'));
    }
  }

  async idReimportar(): Promise<void> {
    if (this.idReimportando()) return;
    if (!confirm('Isso substitui TODO o índice pela planilha modelo. Continuar?')) return;
    this.idReimportando.set(true);
    this.erro.set(null);
    try {
      const n = await this.service.indiceReimportar();
      this.aviso.set(`Índice reimportado (${n} tópicos).`);
      await this.carregarIndice();
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível reimportar o índice.'));
    } finally {
      this.idReimportando.set(false);
    }
  }

  // === Modelos de Documentos ============================================================

  async carregarModelos(): Promise<void> {
    this.mdCarregando.set(true);
    this.erro.set(null);
    try {
      this.mdLista.set(await this.service.modelosListar());
    } catch {
      this.erro.set('Não foi possível carregar os modelos de documento.');
    } finally {
      this.mdCarregando.set(false);
    }
  }

  async mdSelecionar(modelo: ModeloDocumento): Promise<void> {
    this.mdSelecionado.set(modelo);
    this.mdCampoEmEdicao.set(null);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const { versoes, campos } = await this.service.modeloDetalhe(modelo.id);
      this.mdVersoes.set(versoes);
      this.mdCampos.set(campos);
    } catch {
      this.erro.set('Não foi possível carregar o detalhe do modelo.');
    }
  }

  mdVoltar(): void {
    this.mdSelecionado.set(null);
    this.mdCampoEmEdicao.set(null);
    this.erro.set(null);
    this.aviso.set(null);
  }

  async mdEnviarVersao(evento: Event): Promise<void> {
    const modelo = this.mdSelecionado();
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!modelo || !arquivo) return;
    this.mdEnviando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      const versao = await this.service.modeloEnviarVersao(modelo.id, arquivo, this.mdMotivoVersao());
      this.aviso.set(`Nova versão (v${versao}) enviada e marcada como vigente.`);
      this.mdMotivoVersao.set('');
      await this.mdSelecionar(modelo);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível enviar a nova versão.'));
    } finally {
      this.mdEnviando.set(false);
      input.value = '';
    }
  }

  async mdBaixar(versaoId?: number): Promise<void> {
    const modelo = this.mdSelecionado();
    if (!modelo) return;
    try {
      const arquivo = await this.service.modeloBaixar(modelo.id, `${modelo.slug}.${modelo.tipo}`, versaoId);
      baixarNoNavegador(arquivo.blob, arquivo.filename);
    } catch {
      this.erro.set('Não foi possível baixar o arquivo.');
    }
  }

  mdCampoEditar(campo: ModeloDocumentoCampo): void {
    this.mdCampoEmEdicao.set({ ...campo });
  }

  mdCampoNovo(): void {
    this.mdCampoEmEdicao.set(campoVazio());
  }

  mdCampoCancelar(): void {
    this.mdCampoEmEdicao.set(null);
  }

  async mdCampoSalvar(): Promise<void> {
    const modelo = this.mdSelecionado();
    const campo = this.mdCampoEmEdicao();
    if (!modelo || !campo || this.mdCampoSalvando()) return;
    this.mdCampoSalvando.set(true);
    this.erro.set(null);
    try {
      await this.service.modeloCampoSalvar(modelo.id, campo);
      this.mdCampoEmEdicao.set(null);
      await this.mdSelecionar(modelo);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível salvar o campo.'));
    } finally {
      this.mdCampoSalvando.set(false);
    }
  }

  async mdCampoExcluir(campoId: number | undefined): Promise<void> {
    const modelo = this.mdSelecionado();
    if (!modelo || !campoId) return;
    if (!confirm('Excluir este campo do mapa de preenchimento?')) return;
    try {
      await this.service.modeloCampoExcluir(modelo.id, campoId);
      await this.mdSelecionar(modelo);
    } catch (e) {
      this.erro.set(this.mensagemErro(e, 'Não foi possível excluir o campo.'));
    }
  }
}
