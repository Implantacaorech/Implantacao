import { heartbeatRobos, ROBO_DIGEST } from './heartbeat-robos';

describe('heartbeatRobos (M6)', () => {
  beforeEach(() => heartbeatRobos._resetar());

  it('registrar cria o robô sem batimento ainda', () => {
    heartbeatRobos.registrar(ROBO_DIGEST, 'Digest', true, 1000);
    const [r] = heartbeatRobos.estado();
    expect(r.chave).toBe(ROBO_DIGEST);
    expect(r.ativo).toBe(true);
    expect(r.cadenciaMs).toBe(1000);
    expect(r.ultimoEm).toBeNull();
  });

  it('bater marca o último ciclo (ok por padrão)', () => {
    heartbeatRobos.registrar(ROBO_DIGEST, 'Digest', true, 1000);
    heartbeatRobos.bater(ROBO_DIGEST);
    const [r] = heartbeatRobos.estado();
    expect(r.ultimoEm).not.toBeNull();
    expect(r.ultimoStatus).toBe('ok');
  });

  it('bater com erro guarda status e detalhe', () => {
    heartbeatRobos.registrar(ROBO_DIGEST, 'Digest', true, 1000);
    heartbeatRobos.bater(ROBO_DIGEST, 'erro', 'caiu');
    const [r] = heartbeatRobos.estado();
    expect(r.ultimoStatus).toBe('erro');
    expect(r.ultimoDetalhe).toBe('caiu');
  });

  it('re-registrar NÃO apaga o último batimento (só atualiza a definição)', () => {
    heartbeatRobos.registrar(ROBO_DIGEST, 'Digest', true, 1000);
    heartbeatRobos.bater(ROBO_DIGEST);
    const antes = heartbeatRobos.estado()[0].ultimoEm;
    heartbeatRobos.registrar(ROBO_DIGEST, 'Digest', false, 2000); // ex.: robô desligado no reboot
    const [r] = heartbeatRobos.estado();
    expect(r.ultimoEm).toBe(antes);
    expect(r.ativo).toBe(false);
    expect(r.cadenciaMs).toBe(2000);
  });

  it('bater sem registro prévio cria um robô ativo sem cadência', () => {
    heartbeatRobos.bater('avulso');
    const [r] = heartbeatRobos.estado();
    expect(r.chave).toBe('avulso');
    expect(r.ativo).toBe(true);
    expect(r.cadenciaMs).toBeNull();
    expect(r.ultimoEm).not.toBeNull();
  });

  it('estado devolve cópias — mexer no retorno não corrompe o registro', () => {
    heartbeatRobos.registrar(ROBO_DIGEST, 'Digest', true, 1000);
    const snap = heartbeatRobos.estado();
    snap[0].ativo = false;
    expect(heartbeatRobos.estado()[0].ativo).toBe(true);
  });
});
