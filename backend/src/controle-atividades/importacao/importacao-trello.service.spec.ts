import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ImportacaoTrelloService } from './importacao-trello.service';
import { QuadrosService } from '../quadros.service';
import { ListasRepository } from '../repositories/listas.repository';
import { CartoesRepository } from '../repositories/cartoes.repository';
import { DetalhesCartaoRepository } from '../repositories/detalhes-cartao.repository';
import { EventosAtividadeRepository } from '../repositories/eventos-atividade.repository';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

const USER = {
  sub: 7,
  login: 'ever',
  nome: 'Everton',
  perfil: 'Consultor',
  perfis: ['Consultor'],
  codigoSicla: '',
} as AuthUser;

/** Exportação do Trello no formato real. */
function exportacao(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: 'Meu quadro do Trello',
    lists: [
      { id: 'l1', name: 'A fazer', closed: false, pos: 100 },
      { id: 'l2', name: 'Concluído', closed: false, pos: 200 },
    ],
    cards: [
      {
        id: 'c1',
        name: 'Conferir cadastro de NCM',
        desc: 'Os 137 sem NCM estão na planilha.',
        idList: 'l1',
        closed: false,
        pos: 100,
        due: '2026-09-30T12:00:00.000Z',
        labels: [{ name: 'Conversão' }],
        idMembers: ['m1'],
        attachments: [
          { name: 'itens.xlsx', url: 'https://trello.com/x', isUpload: true },
        ],
      },
      { id: 'c2', name: 'Já feito', idList: 'l2', closed: false, pos: 100 },
    ],
    checklists: [
      {
        idCard: 'c1',
        checkItems: [
          { name: 'baixar planilha', state: 'complete', pos: 100 },
          { name: 'corrigir divergentes', state: 'incomplete', pos: 200 },
        ],
      },
    ],
    members: [{ id: 'm1', fullName: 'Marina Bordignon' }],
    actions: [
      {
        type: 'commentCard',
        date: '2026-08-20T10:00:00.000Z',
        data: { text: 'combinado na reunião', card: { id: 'c1' } },
        memberCreator: { fullName: 'Marina' },
      },
    ],
    ...over,
  });
}

describe('ImportacaoTrelloService', () => {
  let service: ImportacaoTrelloService;

  const quadro = {
    id: 1,
    codigoClienteSicla: '10482',
    nomeCliente: 'Vale Verde',
  };
  const quadrosSvc = { exigirEditavel: jest.fn() };
  const listas = { doQuadro: jest.fn(), criar: jest.fn() };
  const cartoes = { criar: jest.fn() };
  const detalhes = {
    incluirItem: jest.fn(),
    incluirAnexo: jest.fn(),
    incluirComentario: jest.fn(),
  };
  const eventos = { registrar: jest.fn() };

  let proximoId = 100;

  beforeEach(async () => {
    jest.clearAllMocks();
    proximoId = 100;
    quadrosSvc.exigirEditavel.mockResolvedValue({ quadro, ctx: {} });
    // O quadro de destino já tem as 5 colunas padrão.
    listas.doQuadro.mockResolvedValue([
      { id: 10, titulo: 'A fazer', ordem: 1024, visivelCliente: true },
      { id: 11, titulo: 'Em andamento', ordem: 2048, visivelCliente: true },
      { id: 12, titulo: 'Concluído', ordem: 3072, visivelCliente: true },
    ]);
    listas.criar.mockImplementation((l: Record<string, unknown>) =>
      Promise.resolve({ ...l, id: (proximoId += 1) }),
    );
    cartoes.criar.mockImplementation((c: Record<string, unknown>) =>
      Promise.resolve({ ...c, id: (proximoId += 1) }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportacaoTrelloService,
        { provide: QuadrosService, useValue: quadrosSvc },
        { provide: ListasRepository, useValue: listas },
        { provide: CartoesRepository, useValue: cartoes },
        { provide: DetalhesCartaoRepository, useValue: detalhes },
        { provide: EventosAtividadeRepository, useValue: eventos },
      ],
    }).compile();
    service = module.get(ImportacaoTrelloService);
  });

  const dePara = [
    { idListaTrello: 'l1', listaId: 10 },
    { idListaTrello: 'l2', listaId: 12 },
  ];

  describe('cada cartão do Trello vira um CARTÃO do Painel', () => {
    it('grava um cartão por cartão do Trello, no quadro do cliente', async () => {
      const r = await service.importar(USER, '10482', exportacao(), dePara);
      expect(cartoes.criar).toHaveBeenCalledTimes(2);
      expect(r.cartoes).toBe(2);
      const titulos = cartoes.criar.mock.calls.map((c) => c[0].titulo);
      expect(titulos).toEqual(['Conferir cadastro de NCM', 'Já feito']);
      expect(cartoes.criar.mock.calls.every((c) => c[0].quadroId === 1)).toBe(
        true,
      );
    });

    it('leva título, descrição, prazo e etiqueta para o cartão', async () => {
      await service.importar(USER, '10482', exportacao(), dePara);
      const c = cartoes.criar.mock.calls[0][0];
      expect(c.titulo).toBe('Conferir cadastro de NCM');
      expect(c.descricao).toContain('Os 137 sem NCM estão na planilha.');
      expect(c.prazo).toBe('2026-09-30');
      expect(c.etiquetas).toBe('conv');
      expect(c.listaId).toBe(10);
    });

    it('o checklist do Trello vira checklist do cartão, com o que estava marcado', async () => {
      const r = await service.importar(USER, '10482', exportacao(), dePara);
      expect(r.checklistItens).toBe(2);
      const itens = detalhes.incluirItem.mock.calls.map((c) => c[0]);
      expect(itens.map((i) => i.texto)).toEqual([
        'baixar planilha',
        'corrigir divergentes',
      ]);
      expect(itens[0].feito).toBe(true);
      expect(itens[1].feito).toBe(false);
    });

    it('o comentário do Trello vira comentário do cartão, com a data no texto', async () => {
      const r = await service.importar(USER, '10482', exportacao(), dePara);
      expect(r.comentarios).toBe(1);
      const m = detalhes.incluirComentario.mock.calls[0][0];
      expect(m.texto).toBe('[2026-08-20] combinado na reunião');
      expect(m.autorNome).toBe('Marina (Trello)');
    });

    it('o anexo vira anexo do cartão (como link, quando era arquivo do Trello)', async () => {
      const r = await service.importar(USER, '10482', exportacao(), dePara);
      expect(r.anexos).toBe(1);
      const a = detalhes.incluirAnexo.mock.calls[0][0];
      expect(a.tipo).toBe('link');
      expect(a.url).toBe('https://trello.com/x');
    });

    it('o responsável do Trello fica anotado, já que não vira usuário do Painel', async () => {
      await service.importar(USER, '10482', exportacao(), dePara);
      expect(cartoes.criar.mock.calls[0][0].descricao).toContain(
        'Responsáveis no Trello: Marina Bordignon',
      );
    });

    it('cartão que cai na coluna "Concluído" entra concluído', async () => {
      await service.importar(USER, '10482', exportacao(), dePara);
      const [primeiro, segundo] = cartoes.criar.mock.calls.map((c) => c[0]);
      expect(primeiro.concluidoEm).toBeNull();
      expect(segundo.concluidoEm).toBeInstanceOf(Date);
    });

    it('os cartões ficam em ordem dentro de cada coluna', async () => {
      await service.importar(
        USER,
        '10482',
        exportacao({
          cards: [
            { id: 'a', name: 'primeiro', idList: 'l1', pos: 100 },
            { id: 'b', name: 'segundo', idList: 'l1', pos: 200 },
          ],
        }),
        dePara,
      );
      const [a, b] = cartoes.criar.mock.calls.map((c) => c[0]);
      expect(a.titulo).toBe('primeiro');
      expect(b.ordem).toBeGreaterThan(a.ordem);
    });
  });

  describe('a garantia que não pode falhar', () => {
    it('TODO cartão importado nasce INTERNO', async () => {
      await service.importar(USER, '10482', exportacao(), dePara);
      expect(
        cartoes.criar.mock.calls.every((c) => c[0].visivelCliente === false),
      ).toBe(true);
    });

    it('coluna criada pela importação também nasce interna', async () => {
      await service.importar(USER, '10482', exportacao(), []);
      expect(listas.criar).toHaveBeenCalledTimes(2);
      expect(
        listas.criar.mock.calls.every((c) => c[0].visivelCliente === false),
      ).toBe(true);
    });

    it('o aviso sobre visibilidade sai sempre no resultado', async () => {
      const r = await service.importar(USER, '10482', exportacao(), dePara);
      expect(r.avisos.join(' ')).toContain('INTERNOS');
    });
  });

  describe('de/para das colunas', () => {
    it('sem escolha, cria coluna com o nome do Trello', async () => {
      const r = await service.importar(USER, '10482', exportacao(), []);
      expect(r.colunasCriadas).toBe(2);
      expect(listas.criar.mock.calls.map((c) => c[0].titulo)).toEqual([
        'A fazer',
        'Concluído',
      ]);
    });

    it('com escolha, reaproveita a coluna existente e não cria nada', async () => {
      const r = await service.importar(USER, '10482', exportacao(), dePara);
      expect(r.colunasCriadas).toBe(0);
      expect(listas.criar).not.toHaveBeenCalled();
    });

    it('id de coluna que não é deste quadro é ignorado — cria coluna nova', async () => {
      const r = await service.importar(USER, '10482', exportacao(), [
        { idListaTrello: 'l1', listaId: 9999 },
        { idListaTrello: 'l2', listaId: 12 },
      ]);
      expect(r.colunasCriadas).toBe(1);
    });
  });

  describe('prévia', () => {
    it('NÃO grava nada — é só o que entraria', async () => {
      const p = await service.previa(USER, '10482', exportacao());
      expect(p.resumo.cartoes).toBe(2);
      expect(p.colunasDoQuadro.map((c) => c.titulo)).toEqual([
        'A fazer',
        'Em andamento',
        'Concluído',
      ]);
      expect(cartoes.criar).not.toHaveBeenCalled();
      expect(listas.criar).not.toHaveBeenCalled();
    });
  });

  describe('recusas', () => {
    it('arquivo que não é do Trello vira 400 com instrução', async () => {
      await expect(service.previa(USER, '10482', 'nada disso')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('acima do teto de cartões, recusa antes de gravar', async () => {
      const muitos = Array.from({ length: 1001 }, (_, i) => ({
        id: `c${i}`,
        name: `Cartão ${i}`,
        idList: 'l1',
        pos: i,
      }));
      await expect(
        service.importar(USER, '10482', exportacao({ cards: muitos }), dePara),
      ).rejects.toThrow(/acima do teto/);
      expect(cartoes.criar).not.toHaveBeenCalled();
    });

    it('quem não é responsável pelo quadro não importa', async () => {
      quadrosSvc.exigirEditavel.mockRejectedValue(
        new Error('Somente consulta'),
      );
      await expect(
        service.importar(USER, '10482', exportacao(), dePara),
      ).rejects.toThrow('Somente consulta');
    });
  });

  it('registra a importação na trilha de auditoria do quadro', async () => {
    await service.importar(USER, '10482', exportacao(), dePara);
    const ev = eventos.registrar.mock.calls[0][0];
    expect(ev.quadroId).toBe(1);
    expect(JSON.parse(ev.detalhe)).toMatchObject({
      importacao: 'trello',
      quadroOrigem: 'Meu quadro do Trello',
      cartoes: 2,
    });
  });
});
