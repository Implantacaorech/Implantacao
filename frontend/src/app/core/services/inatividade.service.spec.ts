import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { PresencaService } from './presenca.service';
import { InatividadeService, OCIOSIDADE_MS } from './inatividade.service';

/** Regra do usuário (2026-09-03): 30 minutos sem atividade derrubam a sessão, nos dois lados
 * (consultor e cliente). O que estes casos travam é a parte que um engano silenciaria: o que
 * CONTA como atividade. Se tráfego de fundo contasse, o temporizador nunca venceria e a
 * guarda existiria só no papel. */

const CHAVE = 'painel.atividade.ultimo';

describe('InatividadeService', () => {
  let servico: InatividadeService;
  const auth = { logout: vi.fn().mockResolvedValue(undefined) };
  const presenca = { encerrar: vi.fn().mockResolvedValue(undefined) };
  const navegou = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(CHAVE);
    TestBed.configureTestingModule({
      providers: [
        InatividadeService,
        { provide: AuthService, useValue: auth },
        { provide: PresencaService, useValue: presenca },
        { provide: Router, useValue: { events: new Subject(), navigate: navegou } },
      ],
    });
    servico = TestBed.inject(InatividadeService);
  });

  afterEach(() => servico.parar());

  it('sem marca nenhuma, a contagem começa AGORA — não derruba quem acabou de entrar', () => {
    expect(servico.restanteMs()).toBeGreaterThan(OCIOSIDADE_MS - 1_000);
  });

  it('a marca é compartilhada entre as abas do mesmo navegador', () => {
    // localStorage, e não sessionStorage: quem trabalha numa aba não pode ser derrubado na
    // outra — para a pessoa é a mesma sessão.
    servico.iniciar();
    expect(Number(localStorage.getItem(CHAVE))).toBeGreaterThan(0);
  });

  it('gesto de gente adia a queda; a marca antiga a aproxima', () => {
    servico.iniciar();
    localStorage.setItem(CHAVE, String(Date.now() - OCIOSIDADE_MS + 5_000));
    expect(servico.restanteMs()).toBeLessThanOrEqual(5_000);

    window.dispatchEvent(new Event('keydown'));
    expect(servico.restanteMs()).toBeGreaterThan(OCIOSIDADE_MS - 1_000);
  });

  it('30 minutos parado derrubam a sessão e explicam o motivo no login', async () => {
    vi.useFakeTimers();
    try {
      servico.iniciar();
      // Envelhece a marca além do corte, como se a aba tivesse ficado aberta e esquecida.
      localStorage.setItem(CHAVE, String(Date.now() - OCIOSIDADE_MS - 1_000));
      await vi.advanceTimersByTimeAsync(61_000);
    } finally {
      vi.useRealTimers();
    }

    expect(presenca.encerrar).toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
    expect(navegou).toHaveBeenCalledWith(['/login'], {
      queryParams: { motivo: 'ociosidade' },
    });
  });

  it('antes dos 30 minutos não derruba nada', async () => {
    vi.useFakeTimers();
    try {
      servico.iniciar();
      localStorage.setItem(CHAVE, String(Date.now() - OCIOSIDADE_MS + 120_000));
      await vi.advanceTimersByTimeAsync(61_000);
    } finally {
      vi.useRealTimers();
    }
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('`parar()` desarma o vigia — logout por vontade própria não vira "ociosidade"', async () => {
    vi.useFakeTimers();
    try {
      servico.iniciar();
      servico.parar();
      localStorage.setItem(CHAVE, String(Date.now() - OCIOSIDADE_MS - 1_000));
      await vi.advanceTimersByTimeAsync(120_000);
    } finally {
      vi.useRealTimers();
    }
    expect(auth.logout).not.toHaveBeenCalled();
    // E o ouvinte saiu junto: um gesto depois de parar não pode ressuscitar a contagem.
    const antes = localStorage.getItem(CHAVE);
    window.dispatchEvent(new Event('keydown'));
    expect(localStorage.getItem(CHAVE)).toBe(antes);
  });
});
