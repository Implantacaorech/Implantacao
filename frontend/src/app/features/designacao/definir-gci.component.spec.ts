import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { DefinirGciComponent } from './definir-gci.component';
import { DesignacaoService } from '../../core/services/designacao.service';
import { ProjetosService } from '../../core/services/projetos.service';
import { DefinirGciView } from '../../core/models/designacao.model';
import { Projeto } from '../../core/models/projeto.model';

function projeto(over: Partial<Projeto> = {}): Projeto {
  return {
    id: 5,
    cliente: 'Cliente Teste',
    cnpj: '',
    numeroProjeto: '',
    numeroProposta: '',
    tipoDemanda: '',
    ramo: '',
    responsavel: '',
    consultor: '',
    gci: '',
    etapa: 'Agendamento',
    situacao: 'Em andamento',
    dataInicio: '',
    dataLevantamento: '',
    dataUsoOficial: '',
    dataEncerramento: '',
    horasCobradas: '',
    horasBonificadas: '',
    modulos: '',
    contatoNome: '',
    contatoEmail: '',
    contatoTel: '',
    comercialEmail: '',
    contatos: '',
    observacoes: '',
    criadoEm: '',
    atualizadoEm: '',
    ...over,
  };
}

describe('DefinirGciComponent', () => {
  function montar(service: Partial<DesignacaoService>, projetos: Partial<ProjetosService> = {}) {
    TestBed.configureTestingModule({
      imports: [DefinirGciComponent],
      providers: [
        provideRouter([]),
        { provide: DesignacaoService, useValue: service },
        { provide: ProjetosService, useValue: { buscar: () => Promise.resolve(projeto()), ...projetos } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    return TestBed.createComponent(DefinirGciComponent);
  }

  function view(over: Partial<DefinirGciView> = {}): DefinirGciView {
    return { gciAtual: '', gcis: ['Ana', 'Beto'], ...over };
  }

  it('pré-marca os GCIs já definidos no projeto', async () => {
    const fixture = montar({ obterDefinirGci: () => Promise.resolve(view({ gciAtual: 'Ana' })) });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.marcado('Ana')).toBe(true);
    expect(comp.marcado('Beto')).toBe(false);
  });

  it('não permite salvar sem nenhum GCI selecionado', async () => {
    const definirGci = vi.fn();
    const fixture = montar({ obterDefinirGci: () => Promise.resolve(view()), definirGci });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(definirGci).not.toHaveBeenCalled();
  });

  it('salva os GCIs selecionados e navega para a tela de agendar levantamento', async () => {
    const definirGci = vi.fn().mockResolvedValue({});
    const fixture = montar({ obterDefinirGci: () => Promise.resolve(view()), definirGci });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    comp.alternar('Ana', true);
    await comp.salvar();
    expect(definirGci).toHaveBeenCalledWith(5, ['Ana']);
    expect(navigateSpy).toHaveBeenCalledWith(['/projetos', 5, 'designacao', 'agendar'], {
      queryParams: { salvo: '1' },
    });
  });
});
