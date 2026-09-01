import { gerarPdfVisitasPortal } from './visitas-portal-pdf';
import { LinhaVisitaPortal } from './bi-implantacao.constants';

function linha(over: Partial<LinhaVisitaPortal> = {}): LinhaVisitaPortal {
  return {
    empresa: 'MELBROS CALCADOS',
    cliente: 3631,
    contato: 'Ernani Martini',
    consultor: 'Everton',
    protocolo: 135089,
    data: '2026-08-06',
    horario: '08:30:00',
    turno: 'MANHÃ',
    aprovado: 'Sim',
    ...over,
  };
}

/** PNG 1×1 válido (a menor imagem possível) — o suficiente para o caminho com gráfico. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('gerarPdfVisitasPortal', () => {
  const base = {
    geradoEm: '17/08/2026 15:00',
    recorte: [
      'Período: 01/08/2026 a 17/08/2026',
      'Visão: geral',
      'Empresa: MELBROS',
    ],
    totais: { total: 3, aprovados: 1, comRessalva: 1, naoAprovados: 1 },
  };

  it('gera um PDF válido com gráfico e tabela', async () => {
    const pdf = await gerarPdfVisitasPortal({
      ...base,
      graficoPng: PNG_1PX,
      linhas: [
        linha(),
        linha({ protocolo: 135090, aprovado: 'Com ressalva' }),
        linha({ protocolo: 135091, aprovado: 'Não' }),
      ],
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('sem gráfico e sem linhas, ainda sai um PDF válido (só o recorte)', async () => {
    const pdf = await gerarPdfVisitasPortal({
      ...base,
      totais: { total: 0, aprovados: 0, comRessalva: 0, naoAprovados: 0 },
      graficoPng: null,
      linhas: [],
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('muitas linhas quebram em várias páginas sem estourar', async () => {
    const muitas = Array.from({ length: 300 }, (_, i) =>
      linha({ protocolo: 130000 + i }),
    );
    const pdf = await gerarPdfVisitasPortal({
      ...base,
      totais: { total: 300, aprovados: 300, comRessalva: 0, naoAprovados: 0 },
      graficoPng: null,
      linhas: muitas,
    });
    // um PDF de várias páginas tem vários objetos /Page
    const paginas = pdf.toString('latin1').match(/\/Type \/Page[^s]/g) ?? [];
    expect(paginas.length).toBeGreaterThan(1);
  });
});
