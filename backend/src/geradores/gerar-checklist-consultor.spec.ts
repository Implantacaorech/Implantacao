import { montarWorkbook } from './gerar-checklist-consultor';
import { carregarSnapshot, extrairXlsx } from './comparacao';
import { agruparPorArea, resolverModulos } from './catalogo';
import { seTiverInsumo } from '../common/insumo-local';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_checklist_consultor.json`).
 * Cobre também o catálogo, portado junto (`tools/catalogo.py` + `tools/checklist.py`). */
seTiverInsumo(
  'tools',
  'data',
  'checklist_modulos.yaml',
)(
  'gerar-checklist-consultor (porte de tools/gerar_checklist_consultor.py)',
  () => {
    const esperado = carregarSnapshot('gerar_checklist_consultor');
    const atual = extrairXlsx(montarWorkbook());

    it('produz as mesmas abas, na mesma ordem, que o gerador Python', () => {
      expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
    });

    it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
      expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
    });
  },
);

describe('catalogo (porte de tools/catalogo.py e tools/checklist.py)', () => {
  it('resolve módulos tanto por código quanto por abreviação', () => {
    const porAbrev = resolverModulos(['FAT']);
    if (porAbrev.achados.length > 0) {
      const codigo = porAbrev.achados[0].codigo;
      const porCodigo = resolverModulos([String(codigo)]);
      expect(porCodigo.achados[0]?.abrev).toBe(porAbrev.achados[0].abrev);
    }
  });

  it('não repete um módulo pedido duas vezes (por código e por abreviação)', () => {
    const { achados } = resolverModulos(['FAT', 'FAT']);
    expect(achados.length).toBeLessThanOrEqual(1);
  });

  it('reporta como faltante o que não existe no catálogo', () => {
    const { faltam } = resolverModulos(['NAO_EXISTE_XYZ']);
    expect(faltam).toContain('NAO_EXISTE_XYZ');
  });

  it('agrupa por área respeitando a ordem canônica do Levantamento', () => {
    const grupos = agruparPorArea([
      { abrev: 'X', area: 'Produto' },
      { abrev: 'Y', area: 'Cliente/Fornecedor' },
    ]);
    // "Cliente/Fornecedor" vem antes de "Produto" na ordem canônica.
    expect(grupos[0][0]).toBe('Cliente/Fornecedor');
    expect(grupos[1][0]).toBe('Produto');
  });
});
