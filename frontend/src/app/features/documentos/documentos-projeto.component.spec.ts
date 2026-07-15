import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { DocumentosProjetoComponent } from './documentos-projeto.component';
import { DocumentosService } from '../../core/services/documentos.service';
import { Documento, EventoProjeto } from '../../core/models/documento.model';

function doc(over: Partial<Documento> = {}): Documento {
  return {
    id: 1,
    projetoId: 5,
    tipo: 'termo',
    arquivo: 'termo_teste.docx',
    caminho: '/dados/termo_teste.docx',
    origem: 'gerado',
    criadoEm: new Date().toISOString(),
    ...over,
  };
}

function evento(over: Partial<EventoProjeto> = {}): EventoProjeto {
  return {
    id: 1,
    projetoId: 5,
    tipo: 'documento',
    descricao: 'Gerou termo_teste.docx pelo layout oficial (termo)',
    autor: 'Ana',
    criadoEm: new Date().toISOString(),
    ...over,
  };
}

describe('DocumentosProjetoComponent', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:fake-url');
    revokeObjectURLSpy = vi.fn();
    URL.createObjectURL = createObjectURLSpy as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLSpy as unknown as typeof URL.revokeObjectURL;
  });

  function montar(service: Partial<DocumentosService>) {
    TestBed.configureTestingModule({
      imports: [DocumentosProjetoComponent],
      providers: [
        provideRouter([]),
        { provide: DocumentosService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    return TestBed.createComponent(DocumentosProjetoComponent);
  }

  it('carrega documentos e eventos do projeto', async () => {
    const fixture = montar({
      listar: () => Promise.resolve([doc()]),
      eventos: () => Promise.resolve([evento()]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('termo_teste.docx');
    expect(texto).toContain('Gerou termo_teste.docx');
  });

  it('gerar aciona o download no navegador e recarrega as listas', async () => {
    const gerarLayout = vi.fn().mockResolvedValue({ blob: new Blob(['x']), filename: 'termo.docx' });
    const listar = vi.fn().mockResolvedValue([]);
    const fixture = montar({ listar, eventos: () => Promise.resolve([]), gerarLayout });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.gerar('termo');
    expect(gerarLayout).toHaveBeenCalledWith(5, 'termo', undefined);
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.aviso()).toContain('termo.docx');
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('gerar modelo do projeto repassa modo=modelo', async () => {
    const gerarLayout = vi.fn().mockResolvedValue({ blob: new Blob(['x']), filename: 'projeto.docx' });
    const fixture = montar({ listar: () => Promise.resolve([]), eventos: () => Promise.resolve([]), gerarLayout });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.gerar('projeto', 'modelo');
    expect(gerarLayout).toHaveBeenCalledWith(5, 'projeto', 'modelo');
  });

  it('mostra erro quando a geração falha', async () => {
    const gerarLayout = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ listar: () => Promise.resolve([]), eventos: () => Promise.resolve([]), gerarLayout });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.gerar('cronograma');
    expect(fixture.componentInstance.erro()).toBe('Não foi possível gerar o documento.');
  });
});
