import PDFDocument from 'pdfkit';
import { LinhaVisitaPortal } from './bi-implantacao.constants';

/** Dados do PDF do painel "Visitas do Portal Rech" — o anexo do "Enviar por e-mail".
 * Tudo chega PRONTO da tela (o recorte descrito, as linhas já filtradas e o gráfico como
 * PNG do próprio canvas): o PDF apresenta exatamente o que o usuário estava vendo. */
export interface DadosPdfVisitas {
  /** "dd/mm/aaaa hh:mm" — carimbo de quando o relatório foi gerado. */
  geradoEm: string;
  /** Linhas descritivas do recorte aplicado (período, visão, filtros ativos). */
  recorte: string[];
  totais: { total: number; aprovados: number; naoAprovados: number };
  /** PNG do gráfico (canvas da tela) — ausente quando a visão não tem barras. */
  graficoPng: Buffer | null;
  linhas: LinhaVisitaPortal[];
}

const NAVY = '#1e3a5f';
const VERDE = '#10b981';
const VERMELHO = '#ef4444';
const CINZA = '#6b7280';
const ZEBRA = '#f3f6fb';

/** Colunas da tabela — mesmas da tela, com larguras que somam a área útil do A4 paisagem. */
const COLUNAS: { titulo: string; campo: keyof LinhaVisitaPortal; largura: number }[] = [
  { titulo: 'Empresa', campo: 'empresa', largura: 200 },
  { titulo: 'Contato', campo: 'contato', largura: 130 },
  { titulo: 'Consultor', campo: 'consultor', largura: 90 },
  { titulo: 'Protocolo', campo: 'protocolo', largura: 60 },
  { titulo: 'Data', campo: 'data', largura: 65 },
  { titulo: 'Horário', campo: 'horario', largura: 55 },
  { titulo: 'Turno', campo: 'turno', largura: 90 },
  { titulo: 'Aprovado', campo: 'aprovado', largura: 55 },
];
const ALTURA_LINHA = 16;

function dataBr(iso: string): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
}

function valorCelula(l: LinhaVisitaPortal, campo: keyof LinhaVisitaPortal): string {
  const v = l[campo];
  if (campo === 'data') return dataBr(String(v ?? ''));
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/** Gera o PDF (A4 paisagem): cabeçalho com o recorte aplicado, contadores, o gráfico e a
 * tabela paginada com zebra — a "apresentação do filtro realizado" pedida pelo usuário. */
export function gerarPdfVisitasPortal(d: DadosPdfVisitas): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      info: { Title: 'Visitas do Portal Rech — aprovação' },
    });
    const blocos: Buffer[] = [];
    doc.on('data', (b: Buffer) => blocos.push(b));
    doc.on('end', () => resolve(Buffer.concat(blocos)));
    doc.on('error', reject);

    const margem = 36;
    const larguraUtil = doc.page.width - margem * 2;
    const fimPagina = () => doc.page.height - margem;

    // ── Cabeçalho ────────────────────────────────────────────────────────────────────
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16);
    doc.text('Visitas do Portal Rech — aprovação', margem, margem);
    doc.font('Helvetica').fontSize(9).fillColor(CINZA);
    doc.text(`Gerado pelo Painel de Implantação em ${d.geradoEm}`);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Recorte aplicado');
    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    for (const linha of d.recorte) doc.text(`• ${linha}`);
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY);
    doc.text(
      `${d.totais.total} protocolo(s)  ·  `,
      { continued: true },
    );
    doc.fillColor(VERDE).text(`${d.totais.aprovados} aprovado(s)`, { continued: true });
    doc.fillColor(NAVY).text('  ·  ', { continued: true });
    doc.fillColor(VERMELHO).text(`${d.totais.naoAprovados} não aprovado(s)`);
    doc.moveDown(0.6);

    // ── Gráfico (o canvas da tela, como imagem) ──────────────────────────────────────
    if (d.graficoPng) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY);
      doc.text('Protocolos por contato — aprovados × não aprovados');
      doc.moveDown(0.3);
      const alturaGrafico = Math.min(240, fimPagina() - doc.y - 40);
      if (alturaGrafico > 80) {
        doc.image(d.graficoPng, margem, doc.y, {
          fit: [larguraUtil, alturaGrafico],
          align: 'center',
        });
        doc.y += alturaGrafico + 10;
      }
    }

    // ── Tabela ───────────────────────────────────────────────────────────────────────
    const cabecalhoTabela = () => {
      let x = margem;
      doc.rect(margem, doc.y, larguraUtil, ALTURA_LINHA).fill(NAVY);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      const yTexto = doc.y + 4;
      for (const c of COLUNAS) {
        doc.text(c.titulo, x + 4, yTexto, {
          width: c.largura - 8,
          lineBreak: false,
          ellipsis: true,
        });
        x += c.largura;
      }
      doc.y += ALTURA_LINHA;
    };

    if (doc.y + ALTURA_LINHA * 3 > fimPagina()) {
      doc.addPage();
      doc.y = margem;
    }
    cabecalhoTabela();

    doc.font('Helvetica').fontSize(8);
    d.linhas.forEach((l, i) => {
      if (doc.y + ALTURA_LINHA > fimPagina()) {
        doc.addPage();
        doc.y = margem;
        cabecalhoTabela();
        doc.font('Helvetica').fontSize(8);
      }
      if (i % 2 === 1) {
        doc.rect(margem, doc.y, larguraUtil, ALTURA_LINHA).fill(ZEBRA);
      }
      let x = margem;
      const yTexto = doc.y + 4;
      for (const c of COLUNAS) {
        doc.fillColor(
          c.campo === 'aprovado'
            ? l.aprovado.trim().toLowerCase() === 'sim'
              ? VERDE
              : VERMELHO
            : '#111827',
        );
        doc.text(valorCelula(l, c.campo), x + 4, yTexto, {
          width: c.largura - 8,
          lineBreak: false,
          ellipsis: true,
        });
        x += c.largura;
      }
      doc.y += ALTURA_LINHA;
    });

    if (d.linhas.length === 0) {
      doc.fillColor(CINZA).text('— nenhum protocolo no recorte —', margem, doc.y + 4);
    }

    doc.end();
  });
}
