import { Documento } from '../database/entities/documento.entity';
import type { DocLeve } from '../metricas/metricas.service';

/** `{projetoId: [{tipo}, ...]}` — mesmo formato que webapp/routes_painel.py monta
 * manualmente em cada view (`docs_map.setdefault(...)`), usado pelo MetricasService. */
export function construirDocsMap(docs: Documento[]): Record<number, DocLeve[]> {
  const map: Record<number, DocLeve[]> = {};
  for (const d of docs) {
    (map[d.projetoId] ??= []).push({ tipo: d.tipo });
  }
  return map;
}
