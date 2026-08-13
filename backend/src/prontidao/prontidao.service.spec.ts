import { ProntidaoService } from './prontidao.service';
import { IaService } from '../ia/ia.service';
import { PRONTIDAO_ACHADOS, PRONTIDAO_EIXOS } from './prontidao.dados';

describe('ProntidaoService', () => {
  function comIa(
    avisos: { finalidade: string; provider: string; viaEnv: boolean }[],
  ) {
    const ia = {
      avisosPrivacidade: jest.fn().mockReturnValue(avisos),
    } as unknown as IaService;
    return new ProntidaoService(ia);
  }

  it('devolve os 9 eixos e todos os achados', () => {
    const r = comIa([]).resumo();
    expect(r.eixos).toHaveLength(9);
    expect(r.achados).toBe(PRONTIDAO_ACHADOS);
    expect(r.dataAuditoria).toBe('2026-08-12');
  });

  it('conta os achados por severidade e por status', () => {
    const r = comIa([]).resumo();
    const somaSev =
      r.totais.porSeveridade.critico +
      r.totais.porSeveridade.alto +
      r.totais.porSeveridade.medio +
      r.totais.porSeveridade.baixo;
    const somaStatus =
      r.totais.porStatus.corrigido +
      r.totais.porStatus.mitigado +
      r.totais.porStatus.aberto;
    expect(somaSev).toBe(PRONTIDAO_ACHADOS.length);
    expect(somaStatus).toBe(PRONTIDAO_ACHADOS.length);
    // As correções desta sessão têm de aparecer como concluídas.
    expect(r.totais.porStatus.corrigido).toBeGreaterThanOrEqual(4);
  });

  it('calcula a maturidade média dos eixos', () => {
    const media =
      PRONTIDAO_EIXOS.reduce((s, e) => s + e.maturidade, 0) /
      PRONTIDAO_EIXOS.length;
    expect(comIa([]).resumo().totais.maturidadeMedia).toBe(
      Math.round(media * 10) / 10,
    );
  });

  it('repassa o sinal AO VIVO de privacidade da IA', () => {
    const aviso = {
      finalidade: 'protocolos',
      provider: 'openrouter',
      viaEnv: false,
    };
    const r = comIa([aviso]).resumo();
    expect(r.privacidadeAoVivo).toEqual([aviso]);
  });

  it('privacidade ao vivo vazia quando não há finalidade sensível fora da rede', () => {
    expect(comIa([]).resumo().privacidadeAoVivo).toEqual([]);
  });
});
