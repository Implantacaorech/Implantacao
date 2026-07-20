import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BaseConhecimentoComponent } from './base-conhecimento.component';
import { BaseConhecimentoService } from '../../core/services/base-conhecimento.service';
import { ResultadoBuscaSiger, StatusBaseConhecimentoSiger } from '../../core/models/siger-fonte.model';

function status(over: Partial<StatusBaseConhecimentoSiger> = {}): StatusBaseConhecimentoSiger {
  return {
    totalIndexado: 7953,
    totalComConteudo: 658,
    ultimaImportacaoEm: '2026-07-18T12:00:00.000Z',
    ...over,
  };
}

function resultado(over: Partial<ResultadoBuscaSiger> = {}): ResultadoBuscaSiger {
  return {
    id: 1,
    caminho: 'CRIAFONTES_MTZ/22.20c/AUE031.CBL',
    extensao: '.cbl',
    pastaRaiz: 'CRIAFONTES_MTZ',
    tamanhoBytes: 12345,
    modificadoEm: '2026-01-01T00:00:00.000Z',
    trecho: '…MOVE SALDO-DEVEDOR TO WS-RESULTADO…',
    ...over,
  };
}

describe('BaseConhecimentoComponent', () => {
  let fixtureAtual: ComponentFixture<BaseConhecimentoComponent> | null = null;

  afterEach(() => {
    fixtureAtual?.destroy();
    fixtureAtual = null;
  });

  function montar(service: Partial<BaseConhecimentoService>) {
    TestBed.configureTestingModule({
      imports: [BaseConhecimentoComponent],
      providers: [{ provide: BaseConhecimentoService, useValue: service }],
    });
    fixtureAtual = TestBed.createComponent(BaseConhecimentoComponent);
    fixtureAtual.detectChanges();
    return fixtureAtual;
  }

  async function esperarTexto(fixture: ComponentFixture<BaseConhecimentoComponent>, trecho: string) {
    const limite = Date.now() + 2000;
    while (Date.now() < limite) {
      fixture.detectChanges();
      if ((fixture.nativeElement.textContent as string).includes(trecho)) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    fixture.detectChanges();
    throw new Error(
      `Texto "${trecho}" não apareceu a tempo. Conteúdo atual: ${fixture.nativeElement.textContent}`,
    );
  }

  it('mostra o alerta de cobertura parcial quando nem tudo foi indexado', async () => {
    const fixture = montar({
      status: () => Promise.resolve(status()),
      pesquisar: () => Promise.resolve([]),
    });
    await esperarTexto(fixture, 'Cobertura parcial');
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('658');
    expect(texto).toMatch(/7[.,]953/); // separador de milhar varia com o locale do ambiente de teste
  });

  it('não pesquisa com menos de 2 caracteres', async () => {
    let chamadas = 0;
    const pesquisar = () => {
      chamadas += 1;
      return Promise.resolve([resultado()]);
    };
    const fixture = montar({ status: () => Promise.resolve(status()), pesquisar });
    fixture.componentInstance.onTermoAlterado('a');
    await new Promise((r) => setTimeout(r, 500));
    expect(chamadas).toBe(0);
  });

  it('pesquisa após o debounce e mostra o trecho do conteúdo', async () => {
    const fixture = montar({
      status: () => Promise.resolve(status()),
      pesquisar: () => Promise.resolve([resultado()]),
    });
    fixture.componentInstance.onTermoAlterado('SALDO-DEVEDOR');
    await esperarTexto(fixture, 'AUE031.CBL');
    expect(fixture.nativeElement.textContent).toContain('SALDO-DEVEDOR');
  });

  it('sem resultado nenhum, mostra mensagem honesta de nada encontrado', async () => {
    const fixture = montar({
      status: () => Promise.resolve(status()),
      pesquisar: () => Promise.resolve([]),
    });
    fixture.componentInstance.onTermoAlterado('inexistente-xyz');
    await esperarTexto(fixture, 'Nada encontrado');
  });

  it('mostra mensagem de erro quando a busca falha', async () => {
    const fixture = montar({
      status: () => Promise.resolve(status()),
      pesquisar: () => Promise.reject(new Error('falhou')),
    });
    fixture.componentInstance.onTermoAlterado('qualquer termo');
    await esperarTexto(fixture, 'Não foi possível pesquisar agora.');
  });
});
