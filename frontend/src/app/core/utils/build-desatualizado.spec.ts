import {
  ehFalhaDeChunk,
  limparMarcaDeRecarga,
  recarregarSeBuildTrocou,
} from './build-desatualizado';

describe('build-desatualizado', () => {
  beforeEach(() => {
    sessionStorage.clear();
    // `location.reload` não é chamável no jsdom; troca por um espião.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    });
  });

  describe('ehFalhaDeChunk', () => {
    it('reconhece as mensagens reais dos navegadores', () => {
      const mensagens = [
        'Failed to fetch dynamically imported module: http://host:5100/chunk-ABC.js',
        'error loading dynamically imported module',
        'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of text/html.',
        'ChunkLoadError: Loading chunk 42 failed.',
      ];
      for (const m of mensagens) {
        expect(ehFalhaDeChunk(new Error(m)), m).toBe(true);
      }
    });

    it('não confunde com erro comum (senha errada, rede fora)', () => {
      expect(ehFalhaDeChunk(new Error('Unauthorized'))).toBe(false);
      expect(ehFalhaDeChunk(new Error('Http failure response'))).toBe(false);
      expect(ehFalhaDeChunk(null)).toBe(false);
    });
  });

  describe('recarregarSeBuildTrocou', () => {
    it('recarrega quando o chunk sumiu', () => {
      const erro = new Error('Failed to fetch dynamically imported module: /chunk-X.js');
      expect(recarregarSeBuildTrocou(erro)).toBe(true);
      expect(location.reload).toHaveBeenCalledTimes(1);
    });

    it('não recarrega por erro que não é de chunk', () => {
      expect(recarregarSeBuildTrocou(new Error('Unauthorized'))).toBe(false);
      expect(location.reload).not.toHaveBeenCalled();
    });

    it('recarrega UMA vez só — build quebrado não vira laço de reload', () => {
      const erro = new Error('Failed to fetch dynamically imported module: /chunk-X.js');
      expect(recarregarSeBuildTrocou(erro)).toBe(true);
      expect(recarregarSeBuildTrocou(erro)).toBe(false);
      expect(recarregarSeBuildTrocou(erro)).toBe(false);
      expect(location.reload).toHaveBeenCalledTimes(1);
    });

    it('depois de uma navegação boa, um rebuild futuro pode recarregar de novo', () => {
      const erro = new Error('Failed to fetch dynamically imported module: /chunk-X.js');
      recarregarSeBuildTrocou(erro);
      limparMarcaDeRecarga();
      expect(recarregarSeBuildTrocou(erro)).toBe(true);
      expect(location.reload).toHaveBeenCalledTimes(2);
    });
  });
});
