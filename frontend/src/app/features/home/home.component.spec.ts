import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { PainelService } from '../../core/services/painel.service';
import { AuthService } from '../../core/services/auth.service';
import { PainelHome } from '../../core/models/painel.model';
import { AuthUser } from '../../core/models/auth-user.model';

function painelVazio(): PainelHome {
  return {
    dados: { ativos: 0, noPrazo: 0, atrasados: 0, alertas: 0, risco: 0, total: 0, concluidos: 0, gatePendente: 0 },
    alertas: [],
    pendencias: [],
    foco: null,
  };
}

function usuario(perfil: AuthUser['perfil'] = 'Consultor'): AuthUser {
  return { sub: 1, login: 'x', nome: 'Fulano', perfil, codigoSicla: '' };
}

describe('HomeComponent', () => {
  function montar(
    painelService: Partial<PainelService>,
    auth: Partial<AuthService> = { usuario: signal(usuario()) },
  ) {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: PainelService, useValue: painelService },
        { provide: AuthService, useValue: auth },
      ],
    });
    const fixture = TestBed.createComponent(HomeComponent);
    return fixture;
  }

  it('mostra "Carregando…" enquanto a chamada está pendente', () => {
    const fixture = montar({ home: () => new Promise(() => {}) });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando');
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    const fixture = montar({ home: () => Promise.reject(new Error('falhou')) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar o painel.');
  });

  it('renderiza os KPIs vindos da API', async () => {
    const dados = painelVazio();
    dados.dados.ativos = 5;
    dados.dados.atrasados = 2;
    const fixture = montar({ home: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('5');
    expect(texto).toContain('2');
    expect(texto).not.toContain('Carregando');
  });

  // Retirados da Visão Geral a pedido do usuário em 2026-07-28: a tela fica só com KPIs,
  // "Minhas próximas ações" e "Alertas" (+ Configurações para o ADM). O `foco` continua
  // vindo da API, mas não é mais renderizado aqui.
  it('não renderiza "Projeto em foco", "Como o fluxo funciona" nem o botão "Novo projeto"', async () => {
    const dados = painelVazio();
    dados.foco = {
      projeto: { id: 1, cliente: 'Cliente X', situacao: 'Em andamento' },
      cabecalho: { stepper: [], proxima: null, proxEtapa: null },
    } as unknown as PainelHome['foco'];
    const fixture = montar({ home: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).not.toContain('Projeto em foco');
    expect(texto).not.toContain('Como o fluxo funciona');
    expect(texto).not.toContain('Novo projeto');
  });

  it('lista as pendências com o rótulo da ação', async () => {
    const dados = painelVazio();
    dados.pendencias = [
      { id: 7, cliente: 'Cliente X', fase: 'Agendamento', atraso: null, acao: 'Definir GCI Responsável', tipo: 'acao:definir_gci' },
    ];
    const fixture = montar({ home: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Cliente X');
    expect(texto).toContain('Definir GCI Responsável');
  });

  it('a próxima ação leva ao FLUXO do projeto, seja qual for o tipo', () => {
    // Desde 2026-07-24 o fluxo vive num lugar só (a tela de Passos = página do projeto);
    // as telas soltas de Designação foram desativadas. Toda pendência aponta para lá.
    const fixture = montar({ home: () => Promise.resolve(painelVazio()) });
    const comp = fixture.componentInstance;
    for (const tipo of [
      'acao:definir_gci',
      'acao:data_levantamento',
      'acao:consultores',
      'algo-desconhecido',
    ]) {
      expect(
        comp.rotaAcao({ id: 3, cliente: '', fase: '', atraso: null, acao: '', tipo }),
      ).toEqual(['/projetos', 3]);
    }
  });

  // "Configurações e saúde" saiu da Visão Geral em 2026-07-28 e virou a tela /ferramentas
  // (ver ferramentas.component.spec.ts) — nem para o ADM ela aparece mais aqui.
  it('não mostra "Configurações e saúde" nem para o ADM', async () => {
    const fixture = montar(
      { home: () => Promise.resolve(painelVazio()) },
      { usuario: signal(usuario('ADM')) },
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Configurações e saúde');
  });
});
