import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ConsultasBdComponent } from './consultas-bd.component';
import { ConsultaBdService } from '../../core/services/consulta-bd.service';
import { ConfigDisponibilidadeService } from '../../core/services/config-disponibilidade.service';
import {
  Instancia,
  InstanciaService,
  PerfilInstancia,
} from '../../core/services/instancia.service';
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
  function instancia(perfil: PerfilInstancia): InstanciaService {
    const i = new InstanciaService();
    const dados: Instancia = {
      perfil,
      nome: perfil === 'portal-api' ? 'Portal API' : 'Painel de Implantação',
      descricao: '',
      rotaInicial: perfil === 'portal-api' ? '/config/api-dados' : '/home',
    };
    i.definir(dados);
    return i;
  }

  function montar(
    slug: string | null,
    servico: Partial<ConsultaBdService>,
    disponibilidade: Partial<ConfigDisponibilidadeService> = {},
    perfil: PerfilInstancia = 'portal-api',
  ) {
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
        { provide: InstanciaService, useFactory: () => instancia(perfil) },
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

  it('no Portal API abre na aba disponibilidade e carrega o status', async () => {
    const status = vi.fn().mockResolvedValue(statusDisponibilidade({ configurado: true }));
    const fixture = montar(null, {}, { status });
    fixture.detectChanges();
    await assentar(fixture);
    expect(fixture.componentInstance.aba()).toBe('disponibilidade');
    expect(fixture.componentInstance.configurado()).toBe(true);
  });

  it('no PAINEL não há abas de conexão — nem na tela, nem como aba inicial', async () => {
    // Decisão do usuário em 2026-08-26: dado de conexão com banco vive no Portal API. Cair
    // numa aba que não existe mais deixaria a tela em branco, então a partida passa a ser a
    // primeira consulta.
    const status = vi.fn();
    const fixture = montar(null, { listar: () => Promise.resolve([consulta()]) }, { status }, 'painel');
    fixture.detectChanges();
    await assentar(fixture);

    expect(fixture.componentInstance.aba()).toBe('previsao-inicio');
    // Sem aba de conexão, o status da conexão nem é buscado.
    expect(status).not.toHaveBeenCalled();
    // As ABAS é que somem. "Banco do Portal Rech" continua aparecendo como opção de ONDE a
    // consulta roda — isso é escolha da consulta, não credencial.
    const abas: string[] = [
      ...fixture.nativeElement.querySelectorAll('.cbd-aba'),
    ].map((b: HTMLElement) => (b.textContent ?? '').trim());
    expect(abas).not.toContain('Disponibilidade');
    expect(abas).not.toContain('Banco do Portal Rech');
  });

  it('no PAINEL, sem consulta nenhuma, cai na aba de criar', async () => {
    const fixture = montar(null, { listar: () => Promise.resolve([]) }, {}, 'painel');
    fixture.detectChanges();
    await assentar(fixture);
    expect(fixture.componentInstance.aba()).toBe('nova');
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
