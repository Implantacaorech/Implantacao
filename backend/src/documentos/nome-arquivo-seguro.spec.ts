import { nomeArquivoSeguro } from './documentos.service';

/** Regressão do achado C2 (auditoria 2026-08-12): o nome de arquivo enviado no upload não pode
 * conter separador de diretório nem sequência de path traversal ao ser gravado no store. */
describe('nomeArquivoSeguro', () => {
  it('preserva um nome comum e sua extensão', () => {
    expect(nomeArquivoSeguro('Projeto Alfa.docx')).toBe('Projeto_Alfa.docx');
    expect(nomeArquivoSeguro('termo-final_v2.pdf')).toBe('termo-final_v2.pdf');
  });

  it('remove componentes de diretório (path traversal POSIX)', () => {
    const saida = nomeArquivoSeguro('a/../../../../evil.js');
    expect(saida).not.toContain('/');
    expect(saida).not.toContain('..');
  });

  it('remove componentes de diretório com barra invertida (Windows)', () => {
    const saida = nomeArquivoSeguro('..\\..\\Windows\\System32\\evil.exe');
    expect(saida).not.toContain('\\');
    expect(saida).not.toContain('/');
    expect(saida).not.toMatch(/\.\./);
  });

  it('não deixa o nome começar com ponto (evita nome oculto / ".." puro)', () => {
    expect(nomeArquivoSeguro('..')).toBe('arquivo');
    expect(nomeArquivoSeguro('...')).toBe('arquivo');
    expect(nomeArquivoSeguro('.env')).toBe('env');
  });

  it('nunca produz um caminho que, concatenado, escape da pasta', () => {
    // O que salvarArquivoGerado faz: `${id}_${ts}_${nome}`. Provamos que o resultado não tem
    // separador — então join(store, resultado) sempre fica dentro de store.
    const nome = nomeArquivoSeguro('x/../../../../../../etc/passwd');
    const concatenado = `5_1723_${nome}`;
    expect(concatenado).not.toContain('/');
    expect(concatenado).not.toContain('\\');
  });

  it('cai para "arquivo" quando o nome fica vazio após a limpeza', () => {
    expect(nomeArquivoSeguro('')).toBe('arquivo');
    expect(nomeArquivoSeguro('/////')).toBe('arquivo');
  });

  it('limita o tamanho do nome', () => {
    const gigante = 'a'.repeat(500) + '.docx';
    expect(nomeArquivoSeguro(gigante).length).toBeLessThanOrEqual(180);
  });
});
