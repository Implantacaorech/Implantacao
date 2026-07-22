import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

export interface ModuloCatalogo {
  codigo: string;
  abrev: string;
  descricao: string;
  area: string;
}

interface LinhaYaml {
  codigo?: string | number;
  abrev?: string;
  descricao?: string;
  area?: string;
}

/** Lê `tools/data/catalogo_modulos.yaml` (dado local, não versionado — mesma convenção
 * de `checklist_modulos.yaml`). Sem cache: só é chamado no "gerar plano automático" do
 * Cronograma, uma ação manual pouco frequente — igual ao Flask original
 * (`tools/catalogo.py:load()`, recarregado a cada chamada). */
function carregarCatalogo(caminhoYaml?: string): ModuloCatalogo[] {
  const caminho =
    caminhoYaml ??
    join(process.cwd(), '..', 'tools', 'data', 'catalogo_modulos.yaml');
  if (!existsSync(caminho)) return [];
  const doc = load(readFileSync(caminho, 'utf8')) as
    { modulos?: LinhaYaml[] } | undefined;
  return (doc?.modulos ?? []).map((m) => ({
    codigo: String(m.codigo ?? ''),
    abrev: String(m.abrev ?? '').toUpperCase(),
    descricao: String(m.descricao ?? ''),
    area: String(m.area ?? 'Outros'),
  }));
}

/** Resolve tokens (código OU abreviação) para as entradas do catálogo, na ordem em que
 * aparecem, sem repetir a mesma abreviação duas vezes. Espelha
 * tools/catalogo.py:resolve — devolve só os encontrados (o port não precisa da lista de
 * "faltantes", só usada por telas de Levantamento ainda não portadas). */
export function resolverModulos(
  tokens: string[],
  caminhoYaml?: string,
): ModuloCatalogo[] {
  const catalogo = carregarCatalogo(caminhoYaml);
  const porCodigo = new Map(catalogo.map((m) => [m.codigo, m]));
  const porAbrev = new Map(catalogo.map((m) => [m.abrev, m]));

  const achados: ModuloCatalogo[] = [];
  const vistos = new Set<string>();
  for (const tokenBruto of tokens) {
    const token = (tokenBruto || '').trim();
    if (!token) continue;
    const m = porCodigo.get(token) ?? porAbrev.get(token.toUpperCase());
    if (m && !vistos.has(m.abrev)) {
      achados.push(m);
      vistos.add(m.abrev);
    }
  }
  return achados;
}
