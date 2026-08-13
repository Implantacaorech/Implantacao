import { killSwitch } from './kill-switch';

describe('killSwitch (eixo 4 — kill switch de runtime)', () => {
  beforeEach(() => killSwitch._resetar());
  afterAll(() => killSwitch._resetar());

  it('começa ATIVO (não pausado)', () => {
    expect(killSwitch.pausado()).toBe(false);
  });

  it('pausar marca pausado, com motivo e autor', () => {
    const e = killSwitch.pausar('gasto de IA disparou', 'everton');
    expect(e.pausado).toBe(true);
    expect(e.motivo).toBe('gasto de IA disparou');
    expect(e.por).toBe('everton');
    expect(killSwitch.pausado()).toBe(true);
  });

  it('motivo em branco vira um texto padrão', () => {
    expect(killSwitch.pausar('   ', 'adm').motivo).toBe('sem motivo informado');
  });

  it('retomar volta a ATIVO', () => {
    killSwitch.pausar('teste', 'adm');
    const e = killSwitch.retomar('adm');
    expect(e.pausado).toBe(false);
    expect(killSwitch.pausado()).toBe(false);
  });

  it('a pausa é PERSISTIDA (sobrevive a uma nova leitura de estado)', () => {
    killSwitch.pausar('incidente', 'adm');
    // Uma nova consulta lê do arquivo, não de cache em memória — prova a persistência.
    expect(killSwitch.estado().pausado).toBe(true);
    expect(killSwitch.estado().motivo).toBe('incidente');
  });
});
