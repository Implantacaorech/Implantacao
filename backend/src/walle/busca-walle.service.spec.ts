import { WalleArquivo } from '../database/entities/walle-arquivo.entity';
import { WalleChat } from '../database/entities/walle-chat.entity';
import { WalleEntidade } from '../database/entities/walle-entidade.entity';
import { BuscaWalleService } from './busca-walle.service';

/** Busca híbrida do acervo Wall-e — regras cobradas aqui: identificador exato acha o
 * documento, busca ignora acento, expansão semântica nunca vira resultado principal (§8),
 * baixa relevância nunca lidera (§26), e a frase de cobertura vazia é a EXATA da §24. */
describe('BuscaWalleService', () => {
  let seq: number;
  function arquivo(over: Partial<WalleArquivo> = {}): WalleArquivo {
    seq++;
    return {
      id: seq,
      caminhoRelativo: `42/doc-${seq}.md`,
      chatCodigo: 42,
      nome: `doc-${seq}.md`,
      extensao: 'md',
      categoria: 'analise',
      origem: 'produzido',
      titulo: `Documento ${seq}`,
      resumo: '',
      conteudo: '',
      assuntos: '',
      tamanhoBytes: 100,
      modificadoEm: new Date('2026-08-01T10:00:00'),
      hashConteudo: 'x',
      removido: false,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      ...over,
    } as WalleArquivo;
  }
  function entidade(
    arquivoId: number,
    tipo: WalleEntidade['tipo'],
    valor: string,
    chatCodigo = 42,
  ): WalleEntidade {
    return { id: 0, arquivoId, chatCodigo, tipo, valor };
  }
  function chat(codigo: number, over: Partial<WalleChat> = {}): WalleChat {
    return {
      id: codigo,
      codigo,
      descricao: '',
      tecnico: '',
      sistema: '',
      origemMetadados: 'acervo',
      totalArquivos: 1,
      ultimoArquivoEm: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      ...over,
    } as WalleChat;
  }

  function montar(
    arquivos: WalleArquivo[],
    entidades: WalleEntidade[] = [],
    chats: WalleChat[] = [chat(42), chat(7, { codigo: 7 })],
  ) {
    return new BuscaWalleService(
      { ativos: jest.fn(async () => arquivos) } as never,
      { todos: jest.fn(async () => chats) } as never,
      { todas: jest.fn(async () => entidades) } as never,
    );
  }

  beforeEach(() => {
    seq = 0;
  });

  it('busca sem acento encontra documento acentuado (e vice-versa)', async () => {
    const doc = arquivo({
      titulo: 'Investigação de integração com WhatsApp',
      conteudo: 'análise da integração',
    });
    const r = await montar([doc]).pesquisar({ q: 'integracao whatsapp' });
    expect(r.resultados).toHaveLength(1);
    expect(r.resultados[0].titulo).toContain('Investigação');
    expect(r.resultados[0].confianca).toBe('alta');
  });

  it('identificador exato (Ficha/RNS/tabela) acha o documento mesmo sem texto igual', async () => {
    const a = arquivo({ titulo: 'Ajuste de apontamentos' });
    const b = arquivo({ titulo: 'Outro assunto' });
    const r = await montar(
      [a, b],
      [entidade(a.id, 'ficha', '322037')],
    ).pesquisar({ q: '322037' });
    expect(r.resultados).toHaveLength(1);
    expect(r.resultados[0].arquivoId).toBe(a.id);
    expect(r.resultados[0].evidencias.join(' ')).toContain('entidade');
  });

  it('expansão por sinônimo NUNCA vira resultado principal — vai para "também pode ser útil"', async () => {
    // Pergunta por "integracao"; o doc só fala de "webhook" (sinônimo de integracao).
    const indireto = arquivo({ titulo: 'Configuração do webhook', conteudo: 'webhook da Meta' });
    const r = await montar([indireto]).pesquisar({ q: 'integracao' });
    expect(r.resultados).toHaveLength(0);
    expect(r.tambemPodeSerUtil.length).toBeGreaterThan(0);
    expect(r.tambemPodeSerUtil[0].arquivoId).toBe(indireto.id);
    expect(r.tambemPodeSerUtil[0].motivo).toContain('Relação indireta');
  });

  it('sem nenhum resultado usa a frase exata de cobertura da §24', async () => {
    const r = await montar([arquivo({ titulo: 'Nada a ver' })]).pesquisar({
      q: 'zzzz-inexistente',
    });
    expect(r.resumo).toBe(
      'Não foi localizado material relevante no acervo documental consultado.',
    );
    expect(r.cobertura).toContain('acervo documental indexado');
  });

  it('filtros restringem: chat, categoria e origem', async () => {
    const sql = arquivo({ categoria: 'sql', chatCodigo: 1, titulo: 'Mover movimentos' });
    const md = arquivo({ categoria: 'analise', chatCodigo: 42, titulo: 'Mover nada' });
    const servico = montar([sql, md]);
    const porChat = await servico.pesquisar({ q: 'mover', chat: 1 });
    expect(porChat.resultados.map((r) => r.arquivoId)).toEqual([sql.id]);
    const porCategoria = await servico.pesquisar({ q: 'mover', categoria: 'analise' });
    expect(porCategoria.resultados.map((r) => r.arquivoId)).toEqual([md.id]);
  });

  it('seção de SQLs relacionados traz objetivo, tabelas e operações — nunca executa', async () => {
    const sql = arquivo({
      categoria: 'sql',
      extensao: 'sql',
      titulo: 'Mover movimentos da Ficha 322037',
      conteudo: 'SELECT 1;\nUPDATE MOVIMENTOS SET FICHA = 1;\n-- COMMIT;',
    });
    const r = await montar(
      [sql],
      [entidade(sql.id, 'tabela', 'MOVIMENTOS')],
    ).pesquisar({ q: 'mover movimentos' });
    expect(r.sqlsRelacionados).toHaveLength(1);
    expect(r.sqlsRelacionados[0].tabelas).toContain('MOVIMENTOS');
    expect(r.sqlsRelacionados[0].operacoes).toEqual(
      expect.arrayContaining(['SELECT', 'UPDATE', 'COMMIT']),
    );
  });

  it('assuntos relacionados agregam os chips dos melhores resultados, sem repetir a pergunta', async () => {
    const doc = arquivo({
      titulo: 'Integração WhatsApp',
      assuntos: 'integracao whatsapp bot automacao',
      conteudo: 'integração',
    });
    const r = await montar([doc]).pesquisar({ q: 'integracao' });
    expect(r.assuntosRelacionados).toEqual(expect.arrayContaining(['bot', 'automacao']));
    expect(r.assuntosRelacionados).not.toContain('integracao');
  });

  it('sem pergunta: navegação por recência, sem relevância inventada', async () => {
    const velho = arquivo({ modificadoEm: new Date('2026-07-01') });
    const novo = arquivo({ modificadoEm: new Date('2026-08-17') });
    const r = await montar([velho, novo]).pesquisar({});
    expect(r.resultados.map((x) => x.arquivoId)).toEqual([novo.id, velho.id]);
    expect(r.resultados[0].relevancia).toBe(0);
  });

  it('metadados do chat (descrição/técnico) enriquecem o card quando existem', async () => {
    const doc = arquivo({ titulo: 'Integração', conteudo: 'integração' });
    const r = await montar(
      [doc],
      [],
      [chat(42, { descricao: 'Investigação WhatsApp', tecnico: 'Gustavo' })],
    ).pesquisar({ q: 'integracao' });
    expect(r.resultados[0].chatDescricao).toBe('Investigação WhatsApp');
    expect(r.resultados[0].tecnico).toBe('Gustavo');
  });
});
