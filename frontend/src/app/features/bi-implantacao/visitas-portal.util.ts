/** Utilitários do painel "Visitas do Portal Rech" (tela Resumo do BI).
 * Puros de propósito: a visão mensal/semanal depende de "hoje", que entra por parâmetro —
 * é o que deixa o recorte testável com data fixa. */

export type VisaoVisitas = 'geral' | 'mensal' | 'semanal';

/** Tintas das três situações de aprovação do Portal (`visita_aprovacao.APROVADO`):
 * `1` = aprovada, `0` = aprovada COM RESSALVA (lá a justificativa é obrigatória) e
 * `NULL` = o cliente ainda não respondeu, que segue contando como não aprovada.
 * O amarelo é o mesmo dos demais gráficos do BI. Espelhadas no PDF do "Enviar por
 * e-mail" (`backend/src/bi-implantacao/visitas-portal-pdf.ts`). */
export const COR_APROVADO = '#10b981';
export const COR_RESSALVA = '#fbbf24';
export const COR_NAO_APROVADO = '#ef4444';

/** Quantos contatos o gráfico mostra (os mais volumosos) — o eixo vira ilegível com
 * dezenas de barras; os demais ficam ao alcance dos filtros do painel. */
export const TOP_CONTATOS_GRAFICO = 15;

/** A data (AAAA-MM-DD) pertence à visão? `geral` = sempre; `mensal` = mesmo mês de hoje;
 * `semanal` = semana de hoje, de segunda a domingo. */
export function dentroDaVisao(
  dataIso: string,
  visao: VisaoVisitas,
  hojeIso: string,
): boolean {
  if (visao === 'geral') return true;
  if (!dataIso) return false;
  if (visao === 'mensal') return dataIso.slice(0, 7) === hojeIso.slice(0, 7);
  const hoje = new Date(`${hojeIso}T00:00:00Z`);
  const dia = hoje.getUTCDay(); // 0 = domingo
  const segunda = new Date(hoje);
  segunda.setUTCDate(hoje.getUTCDate() + (dia === 0 ? -6 : 1 - dia));
  const domingo = new Date(segunda);
  domingo.setUTCDate(segunda.getUTCDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return dataIso >= iso(segunda) && dataIso <= iso(domingo);
}
