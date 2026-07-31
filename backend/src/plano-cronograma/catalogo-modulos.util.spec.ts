import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolverModulos, siglasContratadas } from './catalogo-modulos.util';

describe('resolverModulos', () => {
  let dir: string;
  let arquivo: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'catalogo-modulos-'));
    arquivo = join(dir, 'catalogo_modulos.yaml');
    writeFileSync(
      arquivo,
      [
        'modulos:',
        '- codigo: 1',
        '  abrev: CTB',
        '  descricao: Contabilidade Geral',
        '  area: Fiscal',
        '- codigo: 28',
        '  abrev: CCC',
        "  descricao: ''",
        '  area: Fiscal',
      ].join('\n'),
      'utf8',
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('resolve por código OU por abreviação (case-insensitive)', () => {
    const achados = resolverModulos(['1', 'ccc'], arquivo);
    expect(achados.map((m) => m.abrev)).toEqual(['CTB', 'CCC']);
  });

  it('não repete a mesma abreviação encontrada duas vezes', () => {
    const achados = resolverModulos(['CTB', '1'], arquivo);
    expect(achados).toHaveLength(1);
  });

  it('ignora tokens que não existem no catálogo', () => {
    const achados = resolverModulos(['NAO_EXISTE'], arquivo);
    expect(achados).toEqual([]);
  });

  it('devolve lista vazia quando o arquivo não existe', () => {
    const achados = resolverModulos(['CTB'], join(dir, 'nao-existe.yaml'));
    expect(achados).toEqual([]);
  });
});

describe('siglasContratadas', () => {
  let dir: string;
  let arquivo: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'siglas-contratadas-'));
    arquivo = join(dir, 'catalogo_modulos.yaml');
    writeFileSync(
      arquivo,
      [
        'modulos:',
        '- codigo: 1',
        '  abrev: CTB',
        '  descricao: Contabilidade Geral',
        '  area: Fiscal',
      ].join('\n'),
      'utf8',
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('tira a sigla do detalhe do SICLA — o adicional vence o módulo', () => {
    // Era o buraco que deixava o check-list vazio: `modulos` guarda o CÓDIGO do adicional
    // (105) e o catálogo do roteiro é indexado por SIGLA (NFE).
    const siglas = siglasContratadas(
      {
        modulos: '105',
        modulosDetalhe: JSON.stringify([
          {
            codigo: '105',
            descricao: 'FAT - Faturamento · NFE - Nota Fiscal Eletrônica',
          },
        ]),
      },
      arquivo,
    );
    expect(siglas).toContain('NFE');
  });

  it('usa a sigla do módulo quando não há adicional', () => {
    const siglas = siglasContratadas(
      {
        modulos: '20',
        modulosDetalhe: JSON.stringify([
          { codigo: '20', descricao: 'EST - Estoque' },
        ]),
      },
      arquivo,
    );
    expect(siglas).toEqual(['EST']);
  });

  it('cai no catálogo quando só há o código, sem detalhe', () => {
    const siglas = siglasContratadas({ modulos: '1' }, arquivo);
    expect(siglas).toEqual(['CTB']);
  });

  it('aceita a sigla digitada à mão nos projetos antigos', () => {
    const siglas = siglasContratadas({ modulos: 'FAT, FIN' }, arquivo);
    expect(siglas).toEqual(['FAT', 'FIN']);
  });

  it('não devolve código numérico como se fosse sigla', () => {
    const siglas = siglasContratadas({ modulos: '999' }, arquivo);
    expect(siglas).toEqual([]);
  });

  it('detalhe corrompido não derruba a geração do roteiro', () => {
    const siglas = siglasContratadas(
      { modulos: '1', modulosDetalhe: '{isso não é JSON' },
      arquivo,
    );
    expect(siglas).toEqual(['CTB']);
  });

  it('não repete sigla que veio por duas fontes', () => {
    const siglas = siglasContratadas(
      {
        modulos: '1, CTB',
        modulosDetalhe: JSON.stringify([
          { codigo: '1', descricao: 'CTB - Contabilidade Geral' },
        ]),
      },
      arquivo,
    );
    expect(siglas).toEqual(['CTB']);
  });
});
