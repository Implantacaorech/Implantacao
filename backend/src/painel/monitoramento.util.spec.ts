import {
  estadoSetor,
  formatarDataHoraBr,
  idadeMedia,
  parseData,
  pessoas,
  pnum,
  splitNomes,
} from './monitoramento.util';

describe('monitoramento.util', () => {
  describe('splitNomes', () => {
    it('separa por vírgula, ponto-e-vírgula, barra, quebra de linha ou " e "', () => {
      expect(splitNomes('Ana, Beto; Caio/Dani\nEva e Fabio')).toEqual([
        'Ana',
        'Beto',
        'Caio',
        'Dani',
        'Eva',
        'Fabio',
      ]);
    });

    it('deduplica e ignora vazio', () => {
      expect(splitNomes('Ana, , Ana')).toEqual(['Ana']);
    });

    it('string vazia/nula devolve []', () => {
      expect(splitNomes('')).toEqual([]);
      expect(splitNomes(null)).toEqual([]);
    });
  });

  describe('parseData', () => {
    it('aceita AAAA-MM-DD e DD/MM/AAAA', () => {
      expect(parseData('2026-08-10')?.getDate()).toBe(10);
      expect(parseData('10/08/2026')?.getDate()).toBe(10);
    });

    it('devolve null para vazio ou irreconhecível (NÃO cai em hoje)', () => {
      expect(parseData('')).toBeNull();
      expect(parseData('lixo')).toBeNull();
    });
  });

  describe('pnum', () => {
    it('extrai o primeiro número, aceitando vírgula decimal', () => {
      expect(pnum('10,5h')).toBe(10.5);
      expect(pnum('')).toBe(0);
      expect(pnum(null)).toBe(0);
    });
  });

  describe('idadeMedia', () => {
    it('ignora projetos concluídos e sem criadoEm', () => {
      const hoje = new Date();
      const dez = new Date(hoje.getTime() - 10 * 86_400_000);
      const vinte = new Date(hoje.getTime() - 20 * 86_400_000);
      const media = idadeMedia([
        { criadoEm: dez, situacao: 'Em andamento' },
        { criadoEm: vinte, situacao: 'Em andamento' },
        { criadoEm: vinte, situacao: 'Concluído' },
      ]);
      expect(media).toBe(15); // média(10,20), o concluído é ignorado
    });

    it('lista vazia devolve null', () => {
      expect(idadeMedia([])).toBeNull();
    });
  });

  describe('estadoSetor', () => {
    it('concluído quando não há andamento/pendências/atrasos e já concluiu algo', () => {
      expect(estadoSetor(0, 0, 0, 0, 3)).toEqual([
        'concluido',
        'Processo concluído',
      ]);
    });

    it('aprovação tem prioridade sobre sobrecarga', () => {
      expect(estadoSetor(10, 10, 10, 1, 0)).toEqual([
        'aprovacao',
        'Aguardando aprovação',
      ]);
    });

    it('sobrecarregado quando atrasadas>=2 OU pendentes>=6 OU andamento>=8', () => {
      expect(estadoSetor(0, 0, 2, 0, 0)).toEqual([
        'sobrecarregado',
        'Sobrecarregado',
      ]);
      expect(estadoSetor(0, 6, 0, 0, 0)).toEqual([
        'sobrecarregado',
        'Sobrecarregado',
      ]);
      expect(estadoSetor(8, 0, 0, 0, 0)).toEqual([
        'sobrecarregado',
        'Sobrecarregado',
      ]);
    });

    it('com pendências quando há atraso ou pendente (abaixo do limiar de sobrecarga)', () => {
      expect(estadoSetor(1, 1, 0, 0, 0)).toEqual([
        'pendencias',
        'Com pendências',
      ]);
    });

    it('em espera quando não há andamento nenhum', () => {
      expect(estadoSetor(0, 0, 0, 0, 0)).toEqual(['espera', 'Em espera']);
    });

    it('normal no caso comum', () => {
      expect(estadoSetor(3, 0, 0, 0, 0)).toEqual([
        'normal',
        'Trabalhando normalmente',
      ]);
    });
  });

  describe('pessoas', () => {
    it('array já pronto NÃO é re-separado (mesmo item multi-nome vira um só)', () => {
      expect(pessoas(['Ana, Beto', 'Caio'])).toEqual(['Ana, Beto', 'Caio']);
    });

    it('string bruta É separada em nomes individuais', () => {
      expect(pessoas('Ana, Beto')).toEqual(['Ana', 'Beto']);
    });

    it('deduplica entre os vários argumentos e limita a 8', () => {
      const r = pessoas('Ana', [
        'Ana',
        'Beto',
        'Caio',
        'Dani',
        'Eva',
        'Fabio',
        'Gui',
        'Hugo',
        'Ivo',
      ]);
      expect(r).toHaveLength(8);
      expect(r[0]).toBe('Ana');
    });
  });

  describe('formatarDataHoraBr', () => {
    it('formata DD/MM/AAAA HH:MM com zero à esquerda', () => {
      const d = new Date(2026, 0, 5, 9, 3);
      expect(formatarDataHoraBr(d)).toBe('05/01/2026 09:03');
    });
  });
});
