import { MenusSigerService } from './menus-siger.service';

const DOC_GIN = `# GIN - GIN Industrial

## 5. Mapa de menus

| Caminho | Opcao | Programa | Funcao implantavel |
| --- | --- | --- | --- |
| \`2.1-M\` | Manutencao consolidada de OP | \`GIN201\` | Consultar/manter OPs. |
| \`2.1-P\` | Importacao de pedidos FAT | \`GIN201\` | Gerar/importar OP a partir de pedidos do Faturamento. |
| \`2.2-P\` | Programacao de OP | \`GIN202\` | Programar OP por data e centro. |

## 6. Outra seção
Texto qualquer.
`;

const DOC_SEM_TABELA = `# CNV - Conversoes

## 1. Papel operacional
Rotina utilitária sem mapa de menus em tabela.
`;

function svc(docs: any[]) {
  const repo = { find: jest.fn().mockResolvedValue(docs) } as any;
  return new MenusSigerService(repo);
}

describe('MenusSigerService (parser de menus do SIGER)', () => {
  it('extrai código de acesso, opção, programa e função da tabela Caminho', async () => {
    const s = svc([{ sigla: 'GIN', tipo: 'modulo', titulo: 'GIN - GIN Industrial', conteudo: DOC_GIN }]);
    const tax = await s.taxonomia();
    expect(tax).toHaveLength(1);
    const gin = tax[0];
    expect(gin.menus).toHaveLength(3);
    const p = gin.menus.find((m) => m.codigo === '2.1-P');
    expect(p).toBeDefined();
    expect(p!.opcao).toBe('Importacao de pedidos FAT');
    expect(p!.programa).toBe('GIN201');
    expect(p!.funcao).toContain('Faturamento');
  });

  it('não inventa menus quando o doc não tem tabela Caminho', async () => {
    const s = svc([{ sigla: 'CNV', tipo: 'adicional', titulo: 'CNV', conteudo: DOC_SEM_TABELA }]);
    const tax = await s.taxonomia();
    expect(tax[0].menus).toEqual([]);
  });

  it('ignora docs sem sigla e usa cache (só lê o repo uma vez)', async () => {
    const repo = { find: jest.fn().mockResolvedValue([{ sigla: '', tipo: 'adicional', titulo: '', conteudo: '' }]) } as any;
    const s = new MenusSigerService(repo);
    await s.taxonomia();
    await s.taxonomia();
    expect(repo.find).toHaveBeenCalledTimes(1);
    expect((await s.taxonomia())).toHaveLength(0);
  });
});
