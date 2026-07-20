import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DicionarioService } from './dicionario.service';
import { DicionarioDocumento } from '../database/entities/dicionario-documento.entity';

function doc(over: Partial<DicionarioDocumento> = {}): DicionarioDocumento {
  return {
    id: 1,
    slug: '01-ctb-contabilidade',
    tipo: 'modulo',
    sigla: 'CTB',
    titulo: 'CTB - Contabilidade',
    resumo: 'Centraliza a contabilidade.',
    conteudo:
      '# CTB - Contabilidade\n\n## 8. Configuracoes disponiveis\n\nA configuracao CTB101 define parametros de contabilidade.',
    palavrasChave: 'CTB005 CTB101 CTB106',
    caminhoOrigem: 'C:/docs/modulos/01-ctb-contabilidade.md',
    urlOrigem: 'https://github.com/x/blob/main/modulos/01-ctb-contabilidade.md',
    hashConteudo: 'a'.repeat(64),
    criadoEm: new Date('2026-07-20'),
    atualizadoEm: new Date('2026-07-20'),
    ...over,
  };
}

describe('DicionarioService', () => {
  let service: DicionarioService;

  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getRawOne: jest.fn(),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    qb.andWhere.mockReturnThis();
    qb.orderBy.mockReturnThis();
    qb.take.mockReturnThis();
    qb.select.mockReturnThis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DicionarioService,
        { provide: getRepositoryToken(DicionarioDocumento), useValue: repo },
      ],
    }).compile();
    service = module.get(DicionarioService);
  });

  it('pesquisar por termo devolve o trecho em torno da ocorrência', async () => {
    qb.getMany.mockResolvedValue([doc()]);
    const r = await service.pesquisar({ q: 'CTB101' });
    expect(qb.andWhere).toHaveBeenCalled();
    expect(r[0].trecho).toContain('CTB101');
    expect(r[0].sigla).toBe('CTB');
  });

  it('pesquisar sem termo não gera trecho e ainda aplica filtro de tipo', async () => {
    qb.getMany.mockResolvedValue([doc()]);
    const r = await service.pesquisar({ tipo: 'modulo' });
    expect(r[0].trecho).toBeNull();
    expect(qb.andWhere).toHaveBeenCalledWith('d.tipo = :tipo', {
      tipo: 'modulo',
    });
  });

  it('obter lança NotFound quando o slug não existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.obter('inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('obter devolve o documento com seções reparseadas do conteúdo', async () => {
    repo.findOne.mockResolvedValue(doc());
    const r = await service.obter('01-ctb-contabilidade');
    expect(r.secoes.length).toBeGreaterThan(0);
    expect(r.secoes[0].categoria).toBe('configuracao');
    expect(r.palavrasChave).toEqual(['CTB005', 'CTB101', 'CTB106']);
  });

  it('recuperarParaPergunta prioriza documentos com o termo no título/palavras-chave', async () => {
    repo.find.mockResolvedValue([
      doc(),
      doc({
        id: 2,
        slug: '06-fin',
        sigla: 'FIN',
        titulo: 'FIN - Financeiro',
        palavrasChave: 'FIN',
        conteudo: 'nada aqui',
      }),
    ]);
    const r = await service.recuperarParaPergunta('como configuro o CTB101');
    expect(r[0].sigla).toBe('CTB'); // maior score (termo no conteúdo + palavras-chave)
  });

  it('recuperarParaPergunta devolve vazio quando nada casa', async () => {
    repo.find.mockResolvedValue([doc()]);
    const r = await service.recuperarParaPergunta('xyzabc123 inexistente');
    expect(r).toEqual([]);
  });

  it('status agrega contagens e última ingestão', async () => {
    repo.count
      .mockResolvedValueOnce(87)
      .mockResolvedValueOnce(21)
      .mockResolvedValueOnce(66);
    qb.getRawOne.mockResolvedValue({
      maximo: new Date('2026-07-20T12:00:00Z'),
    });
    const s = await service.status();
    expect(s.totalDocumentos).toBe(87);
    expect(s.totalModulos).toBe(21);
    expect(s.totalAdicionais).toBe(66);
    expect(s.ultimaIngestaoEm).toEqual(new Date('2026-07-20T12:00:00Z'));
  });
});
