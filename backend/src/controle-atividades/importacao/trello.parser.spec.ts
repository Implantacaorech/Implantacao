import {
  TrelloInvalidoError,
  dataDoTrello,
  lerExportacaoTrello,
  mapearEtiqueta,
} from './trello.parser';

/** Exportação mínima e válida, no formato real do Trello. */
function exportacao(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: 'Meu quadro do Trello',
    lists: [
      { id: 'l1', name: 'Hoje', closed: false, pos: 100 },
      { id: 'l2', name: 'Mais tarde', closed: false, pos: 200 },
      { id: 'lx', name: 'Antiga', closed: true, pos: 50 },
    ],
    cards: [
      {
        id: 'c1',
        name: 'Comece a usar o Trello',
        desc: 'Descrição do cartão',
        idList: 'l1',
        closed: false,
        pos: 100,
        due: '2026-09-10T12:00:00.000Z',
        dueComplete: false,
        labels: [{ name: 'Conversão', color: 'purple' }],
        idMembers: ['m1'],
        attachments: [
          {
            name: 'planilha.xlsx',
            url: 'https://trello.com/1/cards/x/att',
            isUpload: true,
          },
          { name: 'Receita', url: 'https://gov.br/nfe', isUpload: false },
        ],
      },
      { id: 'c2', name: 'Teste', idList: 'l2', closed: false, pos: 200 },
      { id: 'c3', name: 'Arquivado', idList: 'l1', closed: true, pos: 300 },
      { id: 'c4', name: 'Órfão', idList: 'lx', closed: false, pos: 400 },
    ],
    checklists: [
      {
        idCard: 'c1',
        name: 'Checklist',
        checkItems: [
          { name: 'segundo', state: 'incomplete', pos: 200 },
          { name: 'primeiro', state: 'complete', pos: 100 },
        ],
      },
    ],
    members: [{ id: 'm1', fullName: 'Everton Remeling', username: 'ever' }],
    actions: [
      {
        type: 'commentCard',
        date: '2026-08-30T10:00:00.000Z',
        data: { text: 'segundo comentário', card: { id: 'c1' } },
        memberCreator: { fullName: 'Marina' },
      },
      {
        type: 'commentCard',
        date: '2026-08-20T10:00:00.000Z',
        data: { text: 'primeiro comentário', card: { id: 'c1' } },
        memberCreator: { fullName: 'Everton' },
      },
      { type: 'updateCard', date: '2026-08-31T10:00:00.000Z', data: {} },
    ],
    ...over,
  });
}

describe('leitura da exportação do Trello', () => {
  describe('arquivo que não serve', () => {
    it('recusa texto que não é JSON, dizendo como exportar de novo', () => {
      expect(() => lerExportacaoTrello('isto não é json')).toThrow(
        TrelloInvalidoError,
      );
      expect(() => lerExportacaoTrello('isto não é json')).toThrow(
        /Exporte de novo/,
      );
    });

    it('recusa JSON que não é um quadro', () => {
      expect(() => lerExportacaoTrello('[]')).toThrow(TrelloInvalidoError);
      expect(() => lerExportacaoTrello('{"name":"x"}')).toThrow(
        /QUADRO inteiro/,
      );
    });

    it('aceita quadro vazio (listas e cartões existem, mas sem conteúdo)', () => {
      const p = lerExportacaoTrello('{"lists":[],"cards":[]}');
      expect(p.resumo.cartoes).toBe(0);
      expect(p.nomeQuadro).toBe('Quadro do Trello');
    });
  });

  describe('listas', () => {
    it('traz as abertas, em ordem, e conta as arquivadas', () => {
      const p = lerExportacaoTrello(exportacao());
      expect(p.listas.map((l) => l.titulo)).toEqual(['Hoje', 'Mais tarde']);
      expect(p.resumo.listasArquivadas).toBe(1);
    });
  });

  describe('cartões', () => {
    it('deixa de fora os arquivados e os órfãos de lista arquivada', () => {
      const p = lerExportacaoTrello(exportacao());
      expect(p.cartoes.map((c) => c.titulo)).toEqual([
        'Comece a usar o Trello',
        'Teste',
      ]);
      expect(p.resumo.cartoesArquivados).toBe(1);
      expect(p.avisos.join(' ')).toContain('listas arquivadas');
    });

    it('lê descrição, prazo e lista de destino', () => {
      const c = lerExportacaoTrello(exportacao()).cartoes[0];
      expect(c.descricao).toBe('Descrição do cartão');
      expect(c.prazo).toBe('2026-09-10');
      expect(c.idListaTrello).toBe('l1');
    });

    it('cartão sem nome não fica sem título', () => {
      const p = lerExportacaoTrello(
        exportacao({ cards: [{ id: 'c9', idList: 'l1', pos: 1 }] }),
      );
      expect(p.cartoes[0].titulo).toBe('Sem título');
    });
  });

  describe('prazo', () => {
    it('corta a data em UTC — converter fuso adiantaria o vencimento em um dia', () => {
      expect(dataDoTrello('2026-09-10T00:00:00.000Z')).toBe('2026-09-10');
      expect(dataDoTrello('2026-01-01T02:30:00.000Z')).toBe('2026-01-01');
    });

    it('sem prazo, vazio', () => {
      expect(dataDoTrello(null)).toBe('');
      expect(dataDoTrello('amanhã')).toBe('');
    });
  });

  describe('etiquetas', () => {
    it('casa por nome, ignorando acento e caixa', () => {
      expect(mapearEtiqueta('Conversão')).toBe('conv');
      expect(mapearEtiqueta('CONVERSAO')).toBe('conv');
      expect(mapearEtiqueta('fiscal')).toBe('fisc');
    });

    it('casa quando um nome contém o outro', () => {
      expect(mapearEtiqueta('Conversão de dados')).toBe('conv');
    });

    it('devolve null para o que não existe no catálogo', () => {
      expect(mapearEtiqueta('Urgente')).toBeNull();
      expect(mapearEtiqueta('')).toBeNull();
    });

    it('as não mapeadas viram AVISO, não somem caladas', () => {
      const p = lerExportacaoTrello(
        exportacao({
          cards: [
            {
              id: 'c1',
              name: 'x',
              idList: 'l1',
              pos: 1,
              labels: [{ name: 'Urgente' }, { name: 'Fiscal' }],
            },
          ],
        }),
      );
      expect(p.cartoes[0].etiquetas).toEqual(['fisc']);
      expect(p.cartoes[0].etiquetasNaoMapeadas).toEqual(['Urgente']);
      expect(p.resumo.etiquetasNaoMapeadas).toEqual(['Urgente']);
      expect(p.avisos.join(' ')).toContain('Urgente');
    });
  });

  describe('checklist', () => {
    it('vem na ordem do Trello, com o que estava marcado', () => {
      const c = lerExportacaoTrello(exportacao()).cartoes[0];
      expect(c.checklist).toEqual([
        { texto: 'primeiro', feito: true },
        { texto: 'segundo', feito: false },
      ]);
      expect(lerExportacaoTrello(exportacao()).resumo.checklistItens).toBe(2);
    });
  });

  describe('comentários', () => {
    it('saem do histórico de ações, do mais antigo para o mais novo', () => {
      const c = lerExportacaoTrello(exportacao()).cartoes[0];
      expect(c.comentarios.map((m) => m.texto)).toEqual([
        'primeiro comentário',
        'segundo comentário',
      ]);
      expect(c.comentarios[0].autor).toBe('Everton');
    });

    it('ignora ação que não é comentário', () => {
      expect(lerExportacaoTrello(exportacao()).resumo.comentarios).toBe(2);
    });
  });

  describe('anexos', () => {
    it('separa arquivo enviado de link colado, e avisa sobre o arquivo', () => {
      const p = lerExportacaoTrello(exportacao());
      expect(p.resumo.anexosArquivo).toBe(1);
      expect(p.resumo.anexosLink).toBe(1);
      expect(p.avisos.join(' ')).toContain('exige estar logado no Trello');
    });

    it('descarta URL que não é http(s) — a tela renderiza como link', () => {
      const p = lerExportacaoTrello(
        exportacao({
          cards: [
            {
              id: 'c1',
              name: 'x',
              idList: 'l1',
              pos: 1,
              attachments: [
                { name: 'mau', url: 'javascript:alert(1)' },
                { name: 'bom', url: 'https://ok.com' },
              ],
            },
          ],
        }),
      );
      expect(p.cartoes[0].anexos.map((a) => a.url)).toEqual(['https://ok.com']);
    });
  });

  describe('membros', () => {
    it('resolve o nome e avisa que a designação é manual', () => {
      const p = lerExportacaoTrello(exportacao());
      expect(p.cartoes[0].membros).toEqual(['Everton Remeling']);
      expect(p.membros).toEqual(['Everton Remeling']);
      expect(p.avisos.join(' ')).toContain('à mão');
    });
  });

  describe('arquivo torto (vem de fora — nada pode assumir tipo)', () => {
    it('campos com o tipo trocado não derrubam a leitura', () => {
      const p = lerExportacaoTrello(
        JSON.stringify({
          name: 42,
          lists: [{ id: 'l1', name: null, pos: 'abc' }],
          cards: [
            {
              id: 'c1',
              name: { x: 1 },
              desc: 7,
              idList: 'l1',
              labels: 'não é array',
              idMembers: null,
              attachments: {},
            },
          ],
          checklists: 'nada',
          actions: null,
          members: 3,
        }),
      );
      expect(p.listas[0].titulo).toBe('Sem título');
      expect(p.cartoes).toHaveLength(1);
      expect(p.cartoes[0].titulo).toBe('Sem título');
      expect(p.cartoes[0].descricao).toBe('7');
      expect(p.cartoes[0].etiquetas).toEqual([]);
      expect(p.cartoes[0].anexos).toEqual([]);
    });

    it('trunca texto longo para caber nas colunas', () => {
      const p = lerExportacaoTrello(
        exportacao({
          cards: [
            {
              id: 'c1',
              name: 'T'.repeat(400),
              desc: 'D'.repeat(9000),
              idList: 'l1',
              pos: 1,
            },
          ],
        }),
      );
      expect(p.cartoes[0].titulo.length).toBe(200);
      expect(p.cartoes[0].descricao.length).toBe(4000);
    });
  });
});
