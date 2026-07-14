export type EstadoSetor = 'concluido' | 'aprovacao' | 'sobrecarregado' | 'pendencias' | 'espera' | 'normal';

/** Separa uma string de nomes por vírgula/ponto-e-vírgula/barra/quebra de linha ou
 * `" e "`, deduplicando. Espelha webapp/routes_painel.py:_split_nomes. */
export function splitNomes(valor: string | null | undefined): string[] {
  const out: string[] = [];
  const partes = (valor || '').split(/[,;/\n]|\s+e\s+/);
  for (const parte of partes) {
    const nome = parte.trim();
    if (nome && !out.includes(nome)) out.push(nome);
  }
  return out;
}

/** "AAAA-MM-DD" ou "DD/MM/AAAA" → Date (meia-noite local) ou `null`. Espelha
 * webapp/routes_painel.py:_parse_data (NÃO cai em "hoje" como o `_parse_date` do gerador
 * de cronograma — aqui a ausência de data é informação relevante, não um valor default). */
export function parseData(valor: string | null | undefined): Date | null {
  const v = (valor || '').trim();
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

export function pnum(s: string | null | undefined): number {
  const m = /\d+(?:[.,]\d+)?/.exec(String(s ?? ''));
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

/** Idade média (dias desde a criação) dos projetos ainda não concluídos da lista.
 * Espelha webapp/routes_painel.py:_idade_media. */
export function idadeMedia(projetos: { criadoEm: Date; situacao: string }[]): number | null {
  const hoje = new Date();
  const idades = projetos
    .filter((p) => p.criadoEm && p.situacao !== 'Concluído')
    .map((p) => Math.floor((hoje.getTime() - new Date(p.criadoEm).getTime()) / 86_400_000));
  if (idades.length === 0) return null;
  return Math.round(idades.reduce((a, b) => a + b, 0) / idades.length);
}

/** Infere o estado do setor a partir das contagens. Espelha
 * webapp/routes_painel.py:_estado_setor. */
export function estadoSetor(
  andamento: number,
  pendentes: number,
  atrasadas: number,
  aprovacao: number,
  concluidas: number,
): [EstadoSetor, string] {
  if (andamento === 0 && pendentes === 0 && atrasadas === 0 && concluidas > 0) {
    return ['concluido', 'Processo concluído'];
  }
  if (aprovacao) return ['aprovacao', 'Aguardando aprovação'];
  if (atrasadas >= 2 || pendentes >= 6 || andamento >= 8) return ['sobrecarregado', 'Sobrecarregado'];
  if (atrasadas || pendentes) return ['pendencias', 'Com pendências'];
  if (andamento === 0) return ['espera', 'Em espera'];
  return ['normal', 'Trabalhando normalmente'];
}

/** Junta nomes de vários campos, sem repetir, no máximo 8. Cada argumento pode ser uma
 * string (é separada por `splitNomes`) OU uma lista já pronta (usada como está, sem
 * separar cada item — mesma distinção de webapp/routes_painel.py:pessoas, importante:
 * ao montar os `setores` os chamadores passam LISTAS [uma por projeto] e cada item NÃO é
 * re-separado; ao montar a `carga` por colaborador os chamadores passam a STRING bruta
 * do projeto (`p.gci`/`p.consultor`), que aí sim é separada em nomes individuais). */
export function pessoas(...campos: (string | string[] | null | undefined)[]): string[] {
  const nomes: string[] = [];
  for (const c of campos) {
    const vals = Array.isArray(c) ? c : splitNomes(c);
    for (const n of vals) {
      if (n && !nomes.includes(n)) nomes.push(n);
    }
  }
  return nomes.slice(0, 8);
}

export function formatarDataHoraBr(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}
