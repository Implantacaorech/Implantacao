import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ConsultasBdComponent } from './consultas-bd.component';
import { ConsultaBdService } from '../../core/services/consulta-bd.service';
import { ConfigDisponibilidadeService } from '../../core/services/config-disponibilidade.service';
import { ConsultaBD } from '../../core/models/consulta-bd.model';
import { StatusConfigDisponibilidade } from '../../core/models/config-disponibilidade.model';

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 6; i++) await fixture.whenStable();
}

function consulta(over: Partial<ConsultaBD> = {}): ConsultaBD {
  return {
    id: 1,
    slug: 'previsao-inicio',
    nome: 'Previsão Início Oficial',
    sql: 'SELECT 1',
    ordem: 0,
    colunaData: 'DATA',
    colunaSituacao: '',
    mostrarGrafico: true,
    conexao: 'sicla',
    ...over,
  };
}

function statusDisponibilidade(over: Partial<StatusConfigDisponibilidade> = {}): StatusConfigDisponibilidade {
  return {
    tipo: 'oracle',
    host: '',
    porta: '',
    banco: '',
    usuario: '',
    url: '',
    select: '',
    selectTecnicos: '',
    oracleLibDir: '',
    ativo: false,
    oracleThick: false,
    configurado: false,
    ...over,
  };
}

describe('ConsultasBdComponent', () => {
  function montar(slug: string | null, servico: Partial<ConsultaBdService>, disponibilidade: Partial<ConfigDisponibilidadeService> = {}) {
    TestBed.configureTestingModule({
      imports: [ConsultasBdComponent],
      providers: [
        provideRouter([]),
        { provide: ConsultaBdService, useValue: { listar: () => Promise.resolve([]), ...servico } },
        {
          provide: ConfigDisponibilidadeService,
          useValue: { status: () => Promise.resolve(statusDisponibilidade()), ...disponibilidade },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(slug ? { slug } : {}) } } },
      ],
    });
    return TestBed.createComponent(ConsultasBdComponent);
  }

  it('lista as consultas salvas como abas', async () => {
    const fixture = montar(null, { listar: () => Promise.resolve([consulta()]) });
    fixture.detectChanges();
    await assentar(fixture);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Previsão Início Oficial');
  });

  it('abre direto na aba disponibilidade por padrão e carrega o status', async () => {
    const status = vi.fn().mockResolvedValue(statusDisponibilidade({ configurado: true }));
    const fixture = montar(null, {}, { status });
    fixture.detectChanges();
    await assentar(fixture);
    expect(fixture.componentInstance.aba()).toBe('disponibilidade');
    expect(fixture.componentInstance.configurado()).toBe(true);
  });

  it('abre na aba da consulta quando o slug vem na rota e pré-preenche o formulário', async () => {
    const fixture = montar('previsao-inicio', { listar: () => Promise.resolve([consulta()]) });
    fixture.detectChanges();
    await assentar(fixture);
    expect(fixture.componentInstance.aba()).toBe('previsao-inicio');
    expect(fixture.componentInstance.formConsulta.getRawValue().nome).toBe('Previsão Início Oficial');
  });

  it('criar consulta chama o backend e troca para a aba da nova consulta', async () => {
    const criar = vi.fn().mockResolvedValue(consulta({ slug: 'nova' }));
    const listar = vi.fn().mockResolvedValue([]);
    const fixture = montar(null, { listar, criar });
    fixture.detectChanges();
    await assentar(fixture);
    const comp = fixture.componentInstance;
    await comp.trocarAba('nova').catch(() => undefined);
    await assentar(fixture);
    comp.formNova.patchValue({ nome: 'Nova', slug: 'nova', sql: 'SELECT 1' });
    await comp.criarConsulta();
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Nova', slug: 'nova', sql: 'SELECT 1' }));
  });

  it('excluir consulta chama o backend e volta para a aba disponibilidade', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const excluir = vi.fn().mockResolvedValue(undefined);
    const listar = vi.fn().mockResolvedValue([consulta()]);
    const fixture = montar('previsao-inicio', { listar, excluir });
    fixture.detectChanges();
    await assentar(fixture);
    await fixture.componentInstance.excluirConsulta();
    expect(excluir).toHaveBeenCalledWith('previsao-inicio');
    expect(fixture.componentInstance.aba()).toBe('disponibilidade');
    confirmSpy.mockRestore();
  });

  it('testar consulta mostra o resultado da execução', async () => {
    const testar = vi.fn().mockResolvedValue({ ok: true, mensagem: '3 linha(s).', colunas: ['A'], linhas: [{ A: 1 }] });
    const atualizar = vi.fn().mockResolvedValue(consulta());
    const fixture = montar('previsao-inicio', {
      listar: () => Promise.resolve([consulta()]),
      atualizar,
      testar,
    });
    fixture.detectChanges();
    await assentar(fixture);
    await fixture.componentInstance.salvarConsulta(true);
    expect(fixture.componentInstance.resultadoTeste()?.mensagem).toBe('3 linha(s).');
  });
});
