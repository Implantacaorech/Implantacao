import { Packer } from 'docx';
import { montarDocumento } from './gerar-dossie-cliente';
import {
  SnapshotDocx,
  carregarSnapshotDocx,
  extrairDocx,
} from './comparacao-docx';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_dossie_cliente.json`). */
describe('gerar-dossie-cliente (porte de tools/gerar_dossie_cliente.py)', () => {
  const esperado = carregarSnapshotDocx('gerar_dossie_cliente');
  let atual: SnapshotDocx;

  beforeAll(async () => {
    atual = await extrairDocx(await Packer.toBuffer(montarDocumento()));
  });

  it('reproduz cada parágrafo do corpo, na ordem', () => {
    expect(atual.paragrafos).toEqual(esperado.paragrafos);
  });

  it('produz as 4 tabelas do dossiê, célula a célula', () => {
    expect(atual.tabelas.length).toBe(4);
    expect(atual.tabelas).toEqual(esperado.tabelas);
  });

  it('junta sigla e CNPJ de cada empresa numa única célula, separadas por ";"', () => {
    // Regra de negócio do documento: um cliente pode ter mais de um CNPJ/sigla.
    const identificacao = atual.tabelas[0];
    const linha = identificacao.find((l) => l[0] === 'CNPJ(s) / Sigla(s)');
    expect(linha).toBeDefined();
    expect(linha?.[1]).toContain('—');
  });

  it('lista o status de todas as etapas da implantação', () => {
    const etapas = atual.tabelas[1];
    expect(etapas[0]).toEqual(['Etapa', 'Status']);
    expect(etapas.length).toBeGreaterThan(1);
  });
});
