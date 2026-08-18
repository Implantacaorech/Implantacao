import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WalleArquivo } from '../database/entities/walle-arquivo.entity';
import { WalleChat } from '../database/entities/walle-chat.entity';
import { IndexacaoWalleService } from './indexacao-walle.service';
import { AcervoFsRepository } from './repositories/acervo-fs.repository';

/** Indexação incremental do acervo Wall-e, contra um acervo de MENTIRA em pasta temporária
 * — NUNCA contra o share real (`R:\GRM\CHAT_WALLE` é fonte somente leitura; teste nenhum a
 * toca). Os repositories de banco são fakes em memória; o de filesystem é o REAL, apontado
 * para o tmpdir (idioma da casa: fixtures em mkdtemp, ver saude/operacao-arquivos). */
describe('IndexacaoWalleService', () => {
  let dir: string;
  let servico: IndexacaoWalleService;
  let arquivos: Map<string, WalleArquivo>;
  let chats: Map<number, WalleChat>;
  let entidadesPorArquivo: Map<number, Array<{ tipo: string; valor: string }>>;

  function fakeArquivosRepo() {
    let seq = 1;
    return {
      todos: jest.fn(async () => [...arquivos.values()]),
      ativos: jest.fn(async () => [...arquivos.values()].filter((a) => !a.removido)),
      porId: jest.fn(async (id: number) =>
        [...arquivos.values()].find((a) => a.id === id) ?? null,
      ),
      porChat: jest.fn(),
      salvar: jest.fn(async (a: Partial<WalleArquivo>) => {
        const existente = a.id
          ? [...arquivos.values()].find((x) => x.id === a.id)
          : undefined;
        const salvo = { ...(existente ?? {}), ...a } as WalleArquivo;
        if (!salvo.id) salvo.id = seq++;
        arquivos.set(salvo.caminhoRelativo, salvo);
        return salvo;
      }),
      marcarRemovido: jest.fn(async (id: number) => {
        for (const a of arquivos.values()) if (a.id === id) a.removido = true;
      }),
      contarAtivos: jest.fn(
        async () => [...arquivos.values()].filter((a) => !a.removido).length,
      ),
    };
  }

  function fakeChatsRepo() {
    let seq = 1;
    return {
      todos: jest.fn(async () => [...chats.values()]),
      porCodigo: jest.fn(async (c: number) => chats.get(c) ?? null),
      salvar: jest.fn(async (c: Partial<WalleChat>) => {
        const salvo = { ...(chats.get(c.codigo!) ?? {}), ...c } as WalleChat;
        if (!salvo.id) salvo.id = seq++;
        chats.set(salvo.codigo, salvo);
        return salvo;
      }),
      contar: jest.fn(async () => chats.size),
    };
  }

  function fakeEntidadesRepo() {
    return {
      todas: jest.fn(async () =>
        [...entidadesPorArquivo.entries()].flatMap(([arquivoId, lista]) =>
          lista.map((e) => ({ arquivoId, chatCodigo: 0, ...e })),
        ),
      ),
      porChat: jest.fn(),
      substituirDoArquivo: jest.fn(async (arquivoId: number, lista: never[]) => {
        entidadesPorArquivo.set(arquivoId, lista);
      }),
      removerDoArquivo: jest.fn(async (arquivoId: number) => {
        entidadesPorArquivo.delete(arquivoId);
      }),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    dir = mkdtempSync(join(tmpdir(), 'walle-acervo-'));
    arquivos = new Map();
    chats = new Map();
    entidadesPorArquivo = new Map();
    const config = { get: jest.fn(() => dir) };
    const fonte = new AcervoFsRepository(config as never);
    servico = new IndexacaoWalleService(
      fonte,
      fakeArquivosRepo() as never,
      fakeChatsRepo() as never,
      fakeEntidadesRepo() as never,
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function criaAcervoBase() {
    mkdirSync(join(dir, '42'));
    writeFileSync(
      join(dir, '42', 'robo-whatsapp.md'),
      '# Há robô na integração com o WhatsApp?\n\nSim: a RNS 563996-1 criou o bot.\n',
      'utf8',
    );
    mkdirSync(join(dir, '1'));
    writeFileSync(
      join(dir, '1', 'mover-movimentos.sql'),
      '-- Mover movimentos da Ficha 322037\nUPDATE MOVIMENTOS SET FICHA = 324288;\n',
      'utf8',
    );
    // Pasta não numérica na raiz é ignorada (não é chat).
    mkdirSync(join(dir, 'PsPadBK'));
    writeFileSync(join(dir, 'PsPadBK', 'lixo.txt'), 'backup de editor', 'utf8');
  }

  it('indexa acervo novo: extrai título, classifica, detecta entidades e consolida chats', async () => {
    criaAcervoBase();
    const r = await servico.sincronizar();

    expect(r.disponivel).toBe(true);
    expect(r.novos).toBe(2);
    expect(r.arquivos).toBe(2);
    expect(r.chats).toBe(2);

    const md = arquivos.get('42/robo-whatsapp.md')!;
    expect(md.titulo).toBe('Há robô na integração com o WhatsApp?');
    expect(md.categoria).toBe('investigacao');
    expect(md.origem).toBe('produzido');
    expect(entidadesPorArquivo.get(md.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ tipo: 'rns', valor: '563996-1' })]),
    );

    const sql = arquivos.get('1/mover-movimentos.sql')!;
    expect(sql.categoria).toBe('sql');
    expect(sql.titulo).toContain('Mover movimentos');
  });

  it('é incremental: segunda passada sem mudança não reprocessa nada', async () => {
    criaAcervoBase();
    await servico.sincronizar();
    const r2 = await servico.sincronizar();
    expect(r2.novos).toBe(0);
    expect(r2.alterados).toBe(0);
    expect(r2.inalterados).toBe(2);
  });

  it('detecta alteração de conteúdo e remoção (marca removido, não apaga)', async () => {
    criaAcervoBase();
    await servico.sincronizar();

    writeFileSync(
      join(dir, '42', 'robo-whatsapp.md'),
      '# Há robô na integração com o WhatsApp?\n\nAtualizado: agora com a Ficha 324397.\n',
      'utf8',
    );
    unlinkSync(join(dir, '1', 'mover-movimentos.sql'));

    const r = await servico.sincronizar();
    expect(r.alterados).toBe(1);
    expect(r.removidos).toBe(1);
    const sql = arquivos.get('1/mover-movimentos.sql')!;
    expect(sql.removido).toBe(true); // preservado no índice, fora da busca
  });

  it('fonte indisponível: devolve disponivel=false e preserva o índice existente', async () => {
    rmSync(dir, { recursive: true, force: true });
    const r = await servico.sincronizar();
    expect(r.disponivel).toBe(false);
    expect(r.mensagem).toContain('indisponível');
  });
});
