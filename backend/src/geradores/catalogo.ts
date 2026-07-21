import { carregarYaml } from './comum';

/** Porte de `tools/catalogo.py` e `tools/checklist.py` para Node/TS (§4.2/§4.7 dos Padrões
 * da Rech). Resolve módulos do catálogo por código ou abreviação e devolve as linhas de
 * roteiro dos módulos contratados. */

export interface ModuloCatalogo {
  codigo?: string | number;
  abrev?: string;
  descricao?: string;
  area?: string;
}

export interface LinhaChecklist {
  modulo?: string;
  adicional?: string;
  tipo?: string;
  integracoes?: string;
  golive?: string;
  menu?: string;
  item?: string;
  acao?: string;
  seq?: string | number;
}

/** Ordem canônica das áreas no Levantamento — `catalogo.AREA_ORDER`. */
export const ORDEM_AREAS = [
  'Cliente/Fornecedor',
  'Produto',
  'Vendas e Faturamento',
  'Produção',
  'Compras/Estoque',
  'Gestão Financeira',
  'Gestão Fiscal, Contábil e Patrimonial',
  'Folha de Pagamento',
  'Recursos Humanos',
  'Recrutamento e Seleção',
  'Treinamentos',
  'Saúde Ocupacional',
  'Segurança do Trabalho',
  'Cargos e Salários',
  'Avaliação e Feedback',
  'Portal de Funcionários',
  'Portal de Vagas',
  'Comércio Exterior',
  'BI e Integrações',
  'Outros',
];

/** Carrega o catálogo de módulos; lista vazia se o arquivo não existir — `catalogo.load()`. */
export function carregarCatalogo(): ModuloCatalogo[] {
  try {
    return (
      carregarYaml<{ modulos?: ModuloCatalogo[] }>('catalogo_modulos.yaml')
        .modulos ?? []
    );
  } catch {
    return [];
  }
}

/** Resolve códigos/abreviações em módulos do catálogo — `catalogo.resolve()`.
 * Devolve os encontrados (sem repetir abreviação) e os que não existem no catálogo. */
export function resolverModulos(tokens: (string | number)[] | undefined): {
  achados: ModuloCatalogo[];
  faltam: (string | number)[];
} {
  const catalogo = carregarCatalogo();
  const porCodigo = new Map<string, ModuloCatalogo>();
  const porAbrev = new Map<string, ModuloCatalogo>();
  for (const m of catalogo) {
    porCodigo.set(String(m.codigo), m);
    porAbrev.set(String(m.abrev ?? '').toUpperCase(), m);
  }

  const achados: ModuloCatalogo[] = [];
  const faltam: (string | number)[] = [];
  const vistos = new Set<string>();
  for (const t of tokens ?? []) {
    const chave = String(t).trim();
    const m = porCodigo.get(chave) ?? porAbrev.get(chave.toUpperCase());
    if (m && !vistos.has(String(m.abrev))) {
      achados.push(m);
      vistos.add(String(m.abrev));
    } else if (!m) {
      faltam.push(t);
    }
  }
  return { achados, faltam };
}

/** Agrupa módulos por área, na ordem canônica — `catalogo.por_area()`. Áreas fora da ordem
 * canônica vão ao final, preservando a ordem de aparição. */
export function agruparPorArea(
  modulos: ModuloCatalogo[],
): [string, ModuloCatalogo[]][] {
  const grupos = new Map<string, ModuloCatalogo[]>();
  for (const m of modulos) {
    const area = m.area ?? 'Outros';
    const lista = grupos.get(area);
    if (lista) lista.push(m);
    else grupos.set(area, [m]);
  }
  const saida: [string, ModuloCatalogo[]][] = [];
  for (const area of ORDEM_AREAS) {
    const lista = grupos.get(area);
    if (lista) {
      saida.push([area, lista]);
      grupos.delete(area);
    }
  }
  for (const [area, lista] of grupos) saida.push([area, lista]);
  return saida;
}

/** Carrega as linhas de checklist; lista vazia se o arquivo não existir — `checklist.load()`. */
export function carregarChecklist(): LinhaChecklist[] {
  try {
    return (
      carregarYaml<{ linhas?: LinhaChecklist[] }>('checklist_modulos.yaml')
        .linhas ?? []
    );
  } catch {
    return [];
  }
}

/** Linhas de roteiro cujo 'adicional' está entre os módulos contratados, na ordem da
 * planilha — `checklist.rows_for()`. */
export function linhasDoChecklist(
  abreviacoes: (string | number)[] | undefined,
): LinhaChecklist[] {
  const contratados = new Set(
    (abreviacoes ?? []).map((a) => String(a).trim().toUpperCase()),
  );
  return carregarChecklist().filter((l) =>
    contratados.has(String(l.adicional ?? '').toUpperCase()),
  );
}
