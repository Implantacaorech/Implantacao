import { aplicarNomes, lerMapa, locutoresDe } from './locutores';

/** A escolha de projeto testada aqui: a transcrição guarda o RÓTULO (`P1`) e o nome vive
 * num mapa à parte. Se alguém trocar isso por substituição de texto, estes testes quebram —
 * e é essa a intenção: renomear tem de ser reversível e não pode corromper o registro. */
describe('locutores', () => {
  const transcricao = [
    '[0:00] P1: Esse é o novo cara, independente se ele é matéria-prima.',
    '[0:57] P2: E se o último descarte que a gente pensou?',
    '[1:13] P1: Tu sabe o que eu estou pensando? Botar na tabela P2 do SIGER.',
  ].join('\n');

  describe('locutoresDe', () => {
    it('lista os rótulos na ordem em que falam, sem repetir', () => {
      expect(locutoresDe(transcricao)).toEqual(['P1', 'P2']);
    });

    it('devolve vazio quando a gravação não separou vozes', () => {
      expect(locutoresDe('[0:00] fala sem locutor\n[0:10] outra fala')).toEqual(
        [],
      );
    });
  });

  describe('aplicarNomes', () => {
    it('troca o rótulo pelo nome no início da fala', () => {
      const r = aplicarNomes(transcricao, { P1: 'Ivian', P2: 'Marcos' });
      expect(r).toContain('[0:00] Ivian: Esse é o novo cara');
      expect(r).toContain('[0:57] Marcos: E se o último descarte');
    });

    it('NÃO troca "P2" citado dentro da fala', () => {
      // O motivo de a marca exigir o timestamp na frente: "tabela P2" é conteúdo, não
      // locutor. Uma substituição cega corromperia o registro.
      const r = aplicarNomes(transcricao, { P1: 'Ivian', P2: 'Marcos' });
      expect(r).toContain('Botar na tabela P2 do SIGER');
    });

    it('quem não tem nome definido continua com o rótulo', () => {
      const r = aplicarNomes(transcricao, { P1: 'Ivian' });
      expect(r).toContain('[0:57] P2: E se o último');
    });

    it('sem mapa, devolve a transcrição intacta', () => {
      expect(aplicarNomes(transcricao, {})).toBe(transcricao);
    });

    it('é reversível: limpar o mapa devolve o texto original', () => {
      const nomeado = aplicarNomes(transcricao, { P1: 'Ivian', P2: 'Marcos' });
      expect(nomeado).not.toBe(transcricao);
      // O original nunca foi tocado — é isso que torna a renomeação segura.
      expect(aplicarNomes(transcricao, {})).toBe(transcricao);
    });
  });

  describe('lerMapa', () => {
    it('lê o JSON e normaliza a chave para maiúscula', () => {
      expect(lerMapa('{"p1":"Ivian"}')).toEqual({ P1: 'Ivian' });
    });

    it('descarta nome vazio e valor que não é texto', () => {
      expect(lerMapa('{"P1":"  ","P2":3,"P3":"Ana"}')).toEqual({ P3: 'Ana' });
    });

    it('mapa corrompido não derruba a ficha', () => {
      expect(lerMapa('{quebrado')).toEqual({});
      expect(lerMapa('[1,2]')).toEqual({});
      expect(lerMapa('')).toEqual({});
      expect(lerMapa(null)).toEqual({});
    });
  });
});
