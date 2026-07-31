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

/** Uma entrada de `Projeto.modulosDetalhe` (JSON gravado no passo 1). */
interface ModuloDetalhe {
  codigo?: string;
  descricao?: string;
}

/** Sigla efetiva de uma descrição de módulo vinda do SICLA.
 *
 * O passo 1 grava a descrição no formato `"FAT - Faturamento"` ou, quando há adicional,
 * `"FAT - Faturamento · NFE - Nota Fiscal Eletrônica"`. Vale o ADICIONAL (o último trecho) —
 * é a mesma regra que define o código efetivo em `modulos-sicla.service.ts`. */
function siglaDaDescricao(descricao: string): string {
  const ultimo = (descricao || '').split('·').pop() ?? '';
  const sigla = ultimo.split(' - ')[0].trim().toUpperCase();
  return /^[A-Z]{2,5}$/.test(sigla) ? sigla : '';
}

/** As SIGLAS dos módulos/adicionais contratados de um projeto.
 *
 * Existe porque as duas pontas falam línguas diferentes: desde que o passo 1 virou a consulta
 * ao SICLA, `Projeto.modulos` guarda CÓDIGOS numéricos (`"105, 20"`), enquanto o roteiro do
 * Check List e o catálogo são indexados por SIGLA (`FAT`, `NFE`). Sem a tradução, o "carregar
 * roteiro dos módulos" casava zero linhas e o check-list vinha vazio.
 *
 * Três fontes, da mais confiável para a de reserva, sem repetir sigla:
 *   1. `modulosDetalhe` — a descrição veio do próprio SICLA e traz a sigla escrita;
 *   2. o catálogo `catalogo_modulos.yaml`, que mapeia código → abreviação;
 *   3. o token cru, para os projetos antigos em que alguém digitou `"FAT, CTB"` à mão. */
export function siglasContratadas(
  projeto: { modulos?: string | null; modulosDetalhe?: string | null },
  caminhoYaml?: string,
): string[] {
  const siglas: string[] = [];
  const vistas = new Set<string>();
  const juntar = (sigla: string) => {
    if (sigla && !vistas.has(sigla)) {
      vistas.add(sigla);
      siglas.push(sigla);
    }
  };

  if (projeto.modulosDetalhe) {
    try {
      const detalhe = JSON.parse(projeto.modulosDetalhe) as ModuloDetalhe[];
      if (Array.isArray(detalhe)) {
        for (const d of detalhe) juntar(siglaDaDescricao(d?.descricao ?? ''));
      }
    } catch {
      // Detalhe corrompido não pode derrubar a geração do roteiro — as outras duas fontes
      // continuam valendo.
    }
  }

  const tokens = (projeto.modulos || '').split(/[,;\n\s]+/).filter(Boolean);
  for (const m of resolverModulos(tokens, caminhoYaml)) juntar(m.abrev);
  // Só os tokens que JÁ são sigla: um código numérico solto que o catálogo não conheça não
  // vira sigla nenhuma, e mandá-lo adiante só sujaria a consulta.
  for (const t of tokens) {
    const bruto = t.trim().toUpperCase();
    if (/^[A-Z]{2,5}$/.test(bruto)) juntar(bruto);
  }

  return siglas;
}
