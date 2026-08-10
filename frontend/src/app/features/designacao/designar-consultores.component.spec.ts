import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { DesignarConsultoresComponent } from './designar-consultores.component';
import { DesignacaoService } from '../../core/services/designacao.service';
import { ProjetosService } from '../../core/services/projetos.service';
import { ConsultoresView } from '../../core/models/designacao.model';
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

describe('DesignarConsultoresComponent', () => {
  function montar(service: Partial<DesignacaoService>, projetos: Partial<ProjetosService> = {}) {
    TestBed.configureTestingModule({
      imports: [DesignarConsultoresComponent],
      providers: [
        provideRouter([]),
        { provide: DesignacaoService, useValue: service },
        { provide: ProjetosService, useValue: { buscar: () => Promise.resolve(projeto()), ...projetos } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    return TestBed.createComponent(DesignarConsultoresComponent);
  }

  function view(over: Partial<ConsultoresView> = {}): ConsultoresView {
    return { modulos: ['FAT', 'CTB'], consultores: ['Ana', 'Beto'], atuais: {}, ...over };
  }

  it('pré-preenche as designações atuais por módulo', async () => {
    const fixture = montar({ obterConsultores: () => Promise.resolve(view({ atuais: { FAT: 'Ana' } })) });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.escolhido('FAT')).toBe('Ana');
    expect(comp.escolhido('CTB')).toBe('');
  });

  it('salva as designações escolhidas e navega para o projeto', async () => {
    const designarConsultores = vi.fn().mockResolvedValue({});
    const fixture = montar({ obterConsultores: () => Promise.resolve(view()), designarConsultores });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    comp.escolher('FAT', 'Ana');
    comp.escolher('CTB', 'Beto');
    await comp.salvar();
    expect(designarConsultores).toHaveBeenCalledWith(5, { FAT: 'Ana', CTB: 'Beto' });
    expect(navigateSpy).toHaveBeenCalledWith(['/projetos', 5]);
  });

  it('mostra mensagem de erro quando salvar falha', async () => {
    const designarConsultores = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ obterConsultores: () => Promise.resolve(view()), designarConsultores });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.salvar();
    expect(comp.erro()).toBe('Não foi possível designar os consultores.');
  });
});
