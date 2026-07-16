import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CadastrosComponent } from './cadastros.component';
import { CadastrosService } from '../../core/services/cadastros.service';
import { ChecklistModeloLinha, IndiceTopicoLinha, ModeloDocumento } from '../../core/models/cadastros.model';

function linhaChecklist(over: Partial<ChecklistModeloLinha> = {}): ChecklistModeloLinha {
  return {
    id: 1,
    modulo: 'FAT',
    adicional: '',
    tipo: 'Cadastro',
    integracoes: '',
    golive: '1.1-P',
    menu: 'Cadastros',
    item: 'Produtos',
    acao: 'Cadastrar produtos',
    seq: '1',
    ...over,
  };
}

function topicoIndice(over: Partial<IndiceTopicoLinha> = {}): IndiceTopicoLinha {
  return {
    id: 1,
    moduloNum: '1',
    moduloSigla: 'FAT',
    modulo: 'Faturamento',
    adicionalNum: '',
    adicionalSigla: '',
    adicional: '',
    topico: 'Emissão de nota fiscal',
    ...over,
  };
}

function modeloDoc(over: Partial<ModeloDocumento> = {}): ModeloDocumento {
  return {
    id: 1,
    slug: 'levantamento',
    nome: 'Mapeamento / Levantamento de Processos',
    fase: 'Levantamento',
    tipo: 'docx',
    arquivo: 'levantamento.docx',
    descricao: '',
    ordem: 0,
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('CadastrosComponent', () => {
  function montar(service: Partial<CadastrosService>) {
    TestBed.configureTestingModule({
      imports: [CadastrosComponent],
      providers: [
        provideRouter([]),
        { provide: CadastrosService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    });
    return TestBed.createComponent(CadastrosComponent);
  }

  it('carrega o Check List ao iniciar (aba padrão)', async () => {
    const fixture = montar({
      checklistListar: () => Promise.resolve({ linhas: [linhaChecklist()], total: 1, modulos: ['FAT'] }),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.clLinhas().length).toBe(1);
    expect(fixture.componentInstance.aba()).toBe('checklist');
  });

  it('clSalvar chama o service e recarrega a lista', async () => {
    const checklistSalvar = vi.fn().mockResolvedValue(linhaChecklist());
    const fixture = montar({
      checklistListar: () => Promise.resolve({ linhas: [linhaChecklist()], total: 1, modulos: ['FAT'] }),
      checklistSalvar,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.clEditar(linhaChecklist({ item: 'Produtos editado' }));
    await fixture.componentInstance.clSalvar();
    expect(checklistSalvar).toHaveBeenCalledWith(expect.objectContaining({ item: 'Produtos editado' }));
    expect(fixture.componentInstance.clEmEdicao()).toBeNull();
  });

  it('troca para a aba Índice e carrega sob demanda', async () => {
    const indiceListar = vi
      .fn()
      .mockResolvedValue({ linhas: [topicoIndice()], total: 1, modulos: ['Faturamento'] });
    const fixture = montar({
      checklistListar: () => Promise.resolve({ linhas: [], total: 0, modulos: [] }),
      indiceListar,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.selecionarAba('indice');
    await fixture.whenStable();
    expect(indiceListar).toHaveBeenCalled();
    expect(fixture.componentInstance.idLinhas().length).toBe(1);
  });

  it('troca para a aba Modelos e carrega a lista sob demanda', async () => {
    const modelosListar = vi.fn().mockResolvedValue([modeloDoc()]);
    const fixture = montar({
      checklistListar: () => Promise.resolve({ linhas: [], total: 0, modulos: [] }),
      modelosListar,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.selecionarAba('modelos');
    await fixture.whenStable();
    expect(modelosListar).toHaveBeenCalled();
    expect(fixture.componentInstance.mdLista().length).toBe(1);
  });

  it('mdSelecionar carrega versões e campos do modelo escolhido', async () => {
    const modeloDetalhe = vi.fn().mockResolvedValue({
      modelo: modeloDoc(),
      versoes: [{ id: 1, versao: 1, arquivo: 'x.docx', autor: 'sistema', motivo: '', vigente: true, criadoEm: '2026-01-01' }],
      campos: [],
    });
    const fixture = montar({
      checklistListar: () => Promise.resolve({ linhas: [], total: 0, modulos: [] }),
      modelosListar: () => Promise.resolve([modeloDoc()]),
      modeloDetalhe,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.mdSelecionar(modeloDoc());
    expect(modeloDetalhe).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.mdVersoes().length).toBe(1);
  });

  it('mostra erro quando salvar falha', async () => {
    const checklistSalvar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({
      checklistListar: () => Promise.resolve({ linhas: [linhaChecklist()], total: 1, modulos: [] }),
      checklistSalvar,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.clEditar(linhaChecklist());
    await fixture.componentInstance.clSalvar();
    expect(fixture.componentInstance.erro()).toBe('Não foi possível salvar a linha.');
  });
});
