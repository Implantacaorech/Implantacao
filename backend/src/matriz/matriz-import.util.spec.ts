import { Workbook, Worksheet } from 'exceljs';
import { parseMatrizWorksheet } from './matriz-import.util';

// Monta uma planilha no mesmo layout de docs/Matriz de Conhecimento.xlsx: linha 7 = área
// (só na 1ª coluna de cada grupo — forward-fill), linha 8 = colunas fixas + siglas,
// linhas 9+ = um técnico por linha.
function planilhaExemplo(): Worksheet {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Matriz');
  ws.getCell('A7').value = null;
  ws.getCell('B7').value = null;
  ws.getCell('C7').value = null;
  ws.getCell('D7').value = null;
  ws.getCell('E7').value = 'AREA: C';
  ws.getCell('F7').value = null; // forward-fill: mesma área de E7
  ws.getCell('G7').value = 'ÁREA N';

  ws.getCell('A8').value = 'Ár';
  ws.getCell('B8').value = 'Nome';
  ws.getCell('C8').value = 'Dias';
  ws.getCell('D8').value = 'Setor';
  ws.getCell('E8').value = 'FAT01';
  ws.getCell('F8').value = 'FAT02';
  ws.getCell('G8').value = 'NEG01';

  ws.getCell('B9').value = 'Ana Técnica';
  ws.getCell('C9').value = '120';
  ws.getCell('D9').value = 'Implantação';
  ws.getCell('E9').value = 8;
  ws.getCell('F9').value = '7,5'; // vírgula decimal -> truncado para 7
  ws.getCell('G9').value = ''; // vazio -> sem nota

  ws.getCell('B10').value = 'Beto Técnico';
  ws.getCell('C10').value = '30';
  ws.getCell('D10').value = 'Suporte';
  ws.getCell('E10').value = 99; // fora da faixa -> clamp em 10
  ws.getCell('F10').value = -5; // fora da faixa -> clamp em 0
  ws.getCell('G10').value = 'não é número'; // inválido -> ignorado

  ws.getCell('B11').value = ''; // linha sem nome -> ignorada
  ws.getCell('E11').value = 5;

  return ws;
}

describe('parseMatrizWorksheet', () => {
  it('lê competências com área via forward-fill e mapeamento de sigla de área', () => {
    const { comps } = parseMatrizWorksheet(planilhaExemplo());
    expect(comps).toEqual([
      { sigla: 'FAT01', area: 'Controladoria', ordem: 1 },
      { sigla: 'FAT02', area: 'Controladoria', ordem: 2 }, // herda a área de FAT01 (forward-fill)
      { sigla: 'NEG01', area: 'Negócios', ordem: 3 },
    ]);
  });

  it('não inclui as colunas fixas (Nome/Dias/Setor/Ár) como competência', () => {
    const { comps } = parseMatrizWorksheet(planilhaExemplo());
    expect(comps.map((c) => c.sigla)).not.toEqual(expect.arrayContaining(['Nome', 'Dias', 'Setor', 'Ár']));
  });

  it('lê os técnicos e clampa as notas em 0-10, aceitando vírgula decimal', () => {
    const { tecnicos } = parseMatrizWorksheet(planilhaExemplo());
    expect(tecnicos).toHaveLength(2); // a linha 11 (sem nome) foi ignorada
    expect(tecnicos[0]).toEqual({
      nome: 'Ana Técnica',
      dias: '120',
      setor: 'Implantação',
      notas: { FAT01: 8, FAT02: 7 }, // "7,5" truncado para 7; NEG01 vazio -> sem entrada
    });
    expect(tecnicos[1].notas).toEqual({ FAT01: 10, FAT02: 0 }); // 99->10, -5->0, NEG01 inválido ignorado
  });
});
