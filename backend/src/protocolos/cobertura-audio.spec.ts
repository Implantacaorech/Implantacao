import { avisoAudioIncompleto, ultimaFalaSeg } from './cobertura-audio';

describe('cobertura de áudio (gravação com microfone morto no meio)', () => {
  describe('ultimaFalaSeg', () => {
    it('acha o último timestamp no formato [M:SS]', () => {
      const t = '[0:02] começo\n[0:10] meio\n[0:15] fim';
      expect(ultimaFalaSeg(t)).toBe(15);
    });

    it('entende horas no formato [H:MM:SS]', () => {
      expect(ultimaFalaSeg('[1:02:30] fala tardia')).toBe(3750);
    });

    it('funciona com rótulo de locutor ([M:SS] P1: fala)', () => {
      expect(ultimaFalaSeg('[3:20] P2: certo, entendi')).toBe(200);
    });

    it('sem timestamp nenhum devolve 0', () => {
      expect(ultimaFalaSeg('texto livre sem marcação')).toBe(0);
    });
  });

  describe('avisoAudioIncompleto', () => {
    /** O caso que motivou o guarda: protocolo 76 (2026-08-14) — treinamento de 20min26s
     * com fala só até 0:15; o pipeline entregou protocolo magro sem avisar ninguém. */
    it('avisa quando a fala termina logo no começo de uma mídia longa', () => {
      const aviso = avisoAudioIncompleto('[0:02] oi\n[0:15] tchau', 1226);
      expect(aviso).toContain('Áudio possivelmente incompleto');
      expect(aviso).toContain('0:15');
      expect(aviso).toContain('20:26');
    });

    it('fala até perto do fim não gera aviso', () => {
      expect(avisoAudioIncompleto('[0:05] oi\n[19:50] fim', 1226)).toBeNull();
    });

    /** Memo de voz curto é uso legítimo — cobertura baixa ali não diz nada. */
    it('mídia com menos de 2 minutos nunca gera aviso', () => {
      expect(avisoAudioIncompleto('[0:02] oi', 90)).toBeNull();
    });

    it('duração desconhecida (0) não gera aviso', () => {
      expect(avisoAudioIncompleto('[0:02] oi', 0)).toBeNull();
    });

    it('exatamente na metade da mídia não gera aviso (limite é "menos que metade")', () => {
      expect(avisoAudioIncompleto('[5:00] fala', 600)).toBeNull();
    });
  });
});
