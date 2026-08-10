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

  /** A busca era `LIKE %termo%` nas quatro colunas, ordenada por sigla — alfabética, não por
   * relevância. Na prática: pesquisar uma frase só achava se ela existisse literalmente, e um
   * termo no título valia o mesmo que um perdido no meio do texto. */
  describe('pesquisar — relevância', () => {
    const faturamento = doc({
      id: 2,
      slug: '05-fat-faturamento',
      sigla: 'FAT',
      titulo: 'FAT - Faturamento',
      resumo: 'Emissão de nota fiscal e devolução de mercadoria.',
      palavrasChave: 'FAT001 nota devolucao',
      conteudo: '# FAT\n\nEmite nota fiscal. Trata devolução de venda.',
    });
    const estoque = doc({
      id: 3,
      slug: '07-est-estoque',
      sigla: 'EST',
      titulo: 'EST - Estoque',
      resumo: 'Controle de saldo.',
      palavrasChave: 'EST001',
      // Cita "nota" só de passagem, e não fala de devolução.
      conteudo: '# EST\n\nO saldo é baixado quando a nota é emitida.',
    });

    it('pesquisa com várias palavras: quem atende mais termos vem primeiro', async () => {
      // Antes, `nota fiscal devolução` era procurado como UMA string literal — e não achava
      // nada, porque essa sequência exata não existe em documento nenhum.
      qb.getMany.mockResolvedValue([estoque, faturamento]);
      const r = await service.pesquisar({ q: 'nota fiscal devolução' });
      expect(r.map((x) => x.sigla)).toEqual(['FAT', 'EST']);
    });

    it('termo no título pesa mais do que o mesmo termo no meio do conteúdo', async () => {
      const citaNoCorpo = doc({
        id: 4,
        slug: '06-fin-financeiro',
        sigla: 'FIN',
        titulo: 'FIN - Financeiro',
        resumo: 'Contas a pagar e receber.',
        palavrasChave: 'FIN001',
        conteudo: '# FIN\n\nIntegra com o faturamento para gerar o título.',
      });
      // Alfabeticamente FIN vem antes de FAT? Não — mas a ordenação antiga era por sigla,
      // então quem decidia o topo era o alfabeto, e não o assunto.
      qb.getMany.mockResolvedValue([citaNoCorpo, faturamento]);
      const r = await service.pesquisar({ q: 'faturamento' });
      expect(r[0].sigla).toBe('FAT');
    });

    it('acha sem acento e recorta o trecho do texto ORIGINAL, com acento', async () => {
      qb.getMany.mockResolvedValue([faturamento]);
      const r = await service.pesquisar({ q: 'devolucao' });
      expect(r).toHaveLength(1);
      // Se a normalização não preservasse posições, o recorte sairia deslocado.
      expect(r[0].trecho).toContain('devolução');
    });

    it('a sigla exata ganha de quem só cita o termo no corpo', async () => {
      const citaFat = doc({
        id: 5,
        slug: '10-cst-custos',
        sigla: 'CST',
        titulo: 'CST - Custos',
        resumo: 'Apuração de custo.',
        palavrasChave: 'CST001',
        conteudo: '# CST\n\nUsa dados do FAT para compor o custo.',
      });
      qb.getMany.mockResolvedValue([citaFat, faturamento]);
      const r = await service.pesquisar({ q: 'FAT' });
      expect(r[0].sigla).toBe('FAT');
    });

    it('descarta palavras vazias — "de"/"da" não podem pontuar documento nenhum', async () => {
      qb.getMany.mockResolvedValue([estoque, faturamento]);
      const r = await service.pesquisar({ q: 'de da do' });
      // Sobrou zero termo buscável: vira navegação (acervo), não uma busca que casa com tudo.
      expect(r.every((x) => x.trecho === null)).toBe(true);
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
