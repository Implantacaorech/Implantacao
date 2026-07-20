import { parseDocumentoMarkdown, extrairTermosCodigo } from './markdown-parser';

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
});
