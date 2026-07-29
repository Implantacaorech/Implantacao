import {
  comHoras,
  modeloExiste,
  montarDocumento,
  normalizarArea,
} from './gerar-levantamento';
import {
  SnapshotDocx,
  carregarSnapshotDocx,
  extrairDocx,
} from './comparacao-docx';
import { seTiverInsumo } from './insumo-local';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_levantamento.json`).
 *
 * Este gerador não constrói documento: ele PREENCHE o modelo oficial da Rech, alterando
 * elementos no lugar. Por isso o teste cobre o documento inteiro — corpo, tabelas, cabeçalhos
 * e rodapés: o que importa é que nada além dos campos dinâmicos tenha mudado. */
seTiverInsumo(
  'tools',
  'templates',
  'base_levantamento_modelo.docx',
)('gerar-levantamento (porte de tools/gerar_levantamento.py)', () => {
  const esperado = carregarSnapshotDocx('gerar_levantamento');
  let atual: SnapshotDocx;

  beforeAll(async () => {
    atual = await extrairDocx(await montarDocumento());
  }, 30000);

  it('preserva a quantidade de parágrafos do modelo', () => {
    // Preencher não pode criar nem apagar parágrafo: o layout é o aprovado pela Rech.
    expect(atual.paragrafos.length).toBe(esperado.paragrafos.length);
  });

  it('reproduz cada parágrafo do corpo, na ordem', () => {
    expect(atual.paragrafos).toEqual(esperado.paragrafos);
  });

  it('reproduz as 5 tabelas do modelo, célula a célula', () => {
    expect(atual.tabelas.length).toBe(5);
    expect(atual.tabelas).toEqual(esperado.tabelas);
  });

  it('preserva cabeçalhos e rodapés do modelo oficial', () => {
    expect(atual.cabecalhos).toEqual(esperado.cabecalhos);
    expect(atual.rodapes).toEqual(esperado.rodapes);
  });

  it('depende do modelo oficial — sua ausência impede a geração', () => {
    expect(modeloExiste()).toBe(true);
  });
});

describe('regras de preenchimento do Levantamento', () => {
  it('acrescenta " horas" quando o valor informado é só número', () => {
    // O formulário pede para informar apenas os números.
    expect(comHoras('8')).toBe('8 horas');
    expect(comHoras(12)).toBe('12 horas');
    expect(comHoras('7,5')).toBe('7,5 horas');
  });

  it('não mexe no valor quando já vem com texto', () => {
    expect(comHoras('a combinar')).toBe('a combinar');
    expect(comHoras('8 horas')).toBe('8 horas');
    expect(comHoras('')).toBe('');
    expect(comHoras(null)).toBe('');
  });

  it('casa o título da área do modelo com o nome do catálogo', () => {
    // O modelo escreve com acento e sufixo "(RHU)"; o catálogo, não.
    expect(normalizarArea('Gestão Financeira')).toBe('gestao financeira');
    expect(normalizarArea('Recursos Humanos (RHU)')).toBe('recursos humanos');
    expect(normalizarArea('Cliente/Fornecedor')).toBe('cliente fornecedor');
  });
});
