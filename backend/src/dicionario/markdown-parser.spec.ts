import {
  parseDocumentoMarkdown,
  extrairTermosCodigo,
  parseBlocos,
  segmentarInline,
} from './markdown-parser';

const DOC = `# CTB - Contabilidade

## 1. Identificacao do modulo

Modulo: CTB - Contabilidade.

## 3. Papel operacional

O CTB centraliza as rotinas de contabilidade do SIGER: parametros, plano de contas e lancamentos.

## 8. Configuracoes disponiveis e efeito tecnico

A configuracao \`CTB101\` no menu \`1.1\` define os parametros do sistema.

## 11. Guia de suporte

Se o lote nao fecha, revisar \`CWREGLTC\`.

## 12. Palavras-chave para pesquisa

\`CTB005\`, \`CTB106\`, \`plano de contas\`.
`;

describe('parseDocumentoMarkdown', () => {
  it('extrai título e sigla a partir do H1', () => {
    const r = parseDocumentoMarkdown(DOC);
    expect(r.titulo).toBe('CTB - Contabilidade');
    expect(r.sigla).toBe('CTB');
  });

  it('quebra o documento em seções e as classifica', () => {
    const r = parseDocumentoMarkdown(DOC);
    const categorias = r.secoes.map((s) => s.categoria);
    expect(categorias).toContain('identificacao');
    expect(categorias).toContain('configuracao');
    expect(categorias).toContain('suporte');
    expect(categorias).toContain('palavras-chave');
  });

  it('usa o papel operacional como resumo', () => {
    const r = parseDocumentoMarkdown(DOC);
    expect(r.resumo).toContain('centraliza as rotinas de contabilidade');
  });

  it('extrai termos de código como palavras-chave', () => {
    const r = parseDocumentoMarkdown(DOC);
    expect(r.palavrasChave).toContain('CTB101');
    expect(r.palavrasChave).toContain('CTB005');
  });

  it('gera um hash SHA-256 determinístico (64 hex)', () => {
    const a = parseDocumentoMarkdown(DOC);
    const b = parseDocumentoMarkdown(DOC);
    expect(a.hashConteudo).toHaveLength(64);
    expect(a.hashConteudo).toBe(b.hashConteudo);
    expect(parseDocumentoMarkdown(DOC + '\nextra').hashConteudo).not.toBe(
      a.hashConteudo,
    );
  });

  it('extrairTermosCodigo ignora caminhos de evidência (F:\\Fontes\\X.CBL:12)', () => {
    const termos = extrairTermosCodigo(
      'use `CTB106` conforme `F:\\Fontes\\CTB005.CBL:2`',
    );
    expect(termos).toContain('CTB106');
    expect(termos).not.toContain('F:\\Fontes\\CTB005.CBL:2');
  });

  it('cada seção vem com blocos estruturados', () => {
    const r = parseDocumentoMarkdown(DOC);
    const conf = r.secoes.find((s) => s.categoria === 'configuracao');
    expect(conf?.blocos.length).toBeGreaterThan(0);
  });
});

describe('segmentarInline', () => {
  it('separa negrito e código do texto normal', () => {
    const segs = segmentarInline('use o menu **1.6-T** com `CTB106` aqui');
    expect(segs).toEqual([
      { texto: 'use o menu ' },
      { texto: '1.6-T', forte: true },
      { texto: ' com ' },
      { texto: 'CTB106', codigo: true },
      { texto: ' aqui' },
    ]);
  });

  it('texto sem marcação vira um único segmento', () => {
    expect(segmentarInline('texto simples')).toEqual([
      { texto: 'texto simples' },
    ]);
  });
});

describe('parseBlocos', () => {
  it('reconhece uma tabela markdown', () => {
    const md =
      '| Caminho | Programa |\n| --- | --- |\n| 1.6 | CTB106 |\n| 2.1 | CTB201 |';
    const blocos = parseBlocos(md);
    expect(blocos).toHaveLength(1);
    const tab = blocos[0];
    expect(tab.tipo).toBe('tabela');
    if (tab.tipo === 'tabela') {
      expect(tab.cabecalho[0][0].texto).toBe('Caminho');
      expect(tab.linhas).toHaveLength(2);
      expect(tab.linhas[0][1][0].texto).toBe('CTB106');
    }
  });

  it('reconhece lista, subtítulo, parágrafo e bloco de código', () => {
    const md =
      '### Sub\n\nUm parágrafo com **negrito**.\n\n- item um\n- item dois\n\n```\ncodigo aqui\n```';
    const tipos = parseBlocos(md).map((b) => b.tipo);
    expect(tipos).toEqual(['subtitulo', 'paragrafo', 'lista', 'codigo']);
  });

  it('agrupa linhas soltas em parágrafo', () => {
    const blocos = parseBlocos('linha um\nlinha dois');
    expect(blocos).toHaveLength(1);
    expect(blocos[0].tipo).toBe('paragrafo');
  });
});
