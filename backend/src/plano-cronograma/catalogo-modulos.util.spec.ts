import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolverModulos } from './catalogo-modulos.util';

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
