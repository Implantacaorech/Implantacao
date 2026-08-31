import type { Chart, Plugin } from 'chart.js/auto';

/** Escreve o VALOR de cada barra no próprio gráfico — pedido do usuário em 2026-08-17:
 * enxergar os números sem depender do tooltip. Plugin inline do Chart.js (sem dependência
 * nova, tipo `chartjs-plugin-datalabels`).
 *
 * Em barras EMPILHADAS (eixo Y com `stacked`), o valor fica em branco no centro de cada
 * segmento e o TOTAL da pilha em cima; segmento com menos de 12px de altura fica sem
 * rótulo para não virar borrão. Em barras lado a lado, o valor (arredondado) fica acima
 * de cada barra. */
export const ROTULOS_NAS_BARRAS: Plugin<'bar'> = {
  id: 'rotulosNasBarras',
  afterDatasetsDraw(chart: Chart<'bar'>) {
    const escalaY = chart.options.scales?.['y'] as { stacked?: boolean } | undefined;
    const empilhado = Boolean(escalaY?.stacked);
    const { ctx } = chart;
    const rotulo = (v: number) => Math.round(v).toLocaleString('pt-BR');
    ctx.save();
    ctx.textAlign = 'center';

    const pilhas = new Map<number, { x: number; topo: number; total: number }>();
    chart.data.datasets.forEach((ds, i) => {
      if (!chart.isDatasetVisible(i)) return;
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((el, j) => {
        const barra = el as unknown as { x: number; y: number; base: number };
        if (!Number.isFinite(barra.x) || !Number.isFinite(barra.y)) return;
        const v = Number((ds.data as unknown[])[j] ?? 0);
        if (!Number.isFinite(v)) return;
        if (empilhado) {
          const p = pilhas.get(j) ?? { x: barra.x, topo: Infinity, total: 0 };
          p.total += v;
          p.topo = Math.min(p.topo, barra.y);
          p.x = barra.x;
          pilhas.set(j, p);
          if (v > 0 && Math.abs(barra.base - barra.y) >= 12) {
            ctx.font = '700 11px system-ui, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'middle';
            ctx.fillText(rotulo(v), barra.x, (barra.y + barra.base) / 2);
          }
        } else if (v !== 0) {
          ctx.font = '700 10px system-ui, sans-serif';
          ctx.fillStyle = '#374151';
          ctx.textBaseline = 'bottom';
          ctx.fillText(rotulo(v), barra.x, barra.y - 2);
        }
      });
    });

    if (empilhado) {
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillStyle = '#1f2937';
      ctx.textBaseline = 'bottom';
      for (const p of pilhas.values()) {
        if (p.total > 0 && Number.isFinite(p.topo)) {
          ctx.fillText(rotulo(p.total), p.x, p.topo - 3);
        }
      }
    }
    ctx.restore();
  },
};
