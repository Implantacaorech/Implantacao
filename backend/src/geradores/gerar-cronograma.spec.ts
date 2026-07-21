import { Packer } from 'docx';
import {
  distribuir,
  fmt,
  montarDocumento,
  num,
  planoAutomatico,
  proximoUtil,
  somarUteis,
  templateBaseExiste,
} from './gerar-cronograma';
import {
  SnapshotDocx,
  carregarSnapshotDocx,
  extrairDocx,
} from './comparacao-docx';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_cronograma.json`). */
describe('gerar-cronograma (porte de tools/gerar_cronograma.py)', () => {
  const esperado = carregarSnapshotDocx('gerar_cronograma');
  let atual: SnapshotDocx;

  beforeAll(async () => {
    atual = await extrairDocx(await Packer.toBuffer(montarDocumento()));
  });

  it('reproduz cada parágrafo do corpo, na ordem', () => {
    expect(atual.paragrafos).toEqual(esperado.paragrafos);
  });

  it('reproduz a tabela de agendas, célula a célula', () => {
    expect(atual.tabelas).toEqual(esperado.tabelas);
  });

  it('fecha a tabela com a linha de Total somando as horas das agendas', () => {
    const tabela = atual.tabelas[0];
    const total = tabela[tabela.length - 1];
    expect(total[3]).toBe('Total');
    const soma = tabela.slice(1, -1).reduce((acc, l) => acc + num(l[4]), 0);
    expect(total[4]).toBe(`${fmt(soma)} h`);
  });

  // O original chamaria `tools/templates/base_cronograma.docx` se ele existisse; como não
  // existe, o Python monta o documento do zero — e é isso que o porte reproduz. Se alguém
  // adicionar o template, o Python muda de comportamento e o porte passa a divergir em
  // silêncio (margens, cabeçalho e rodapé oficiais). Este teste é o alarme.
  it('continua sem template base — se um for adicionado, o porte precisa ser revisto', () => {
    expect(templateBaseExiste()).toBe(false);
  });
});

describe('regras de cálculo do cronograma', () => {
  it('extrai o primeiro número do texto, aceitando vírgula decimal', () => {
    expect(num('40')).toBe(40);
    expect(num('7,5 horas')).toBe(7.5);
    expect(num('a combinar')).toBe(0);
  });

  it('formata hora inteira sem decimal e quebrada com uma casa', () => {
    expect(fmt(48)).toBe('48');
    expect(fmt(7.5)).toBe('7.5');
  });

  it('pula fim de semana ao definir a primeira agenda', () => {
    // 2026-07-18 é sábado; a primeira agenda cai na segunda-feira seguinte.
    const sabado = new Date(2026, 6, 18);
    expect(sabado.getDay()).toBe(6);
    expect(proximoUtil(sabado).getDay()).toBe(1);
  });

  it('conta apenas dias úteis ao espaçar as agendas', () => {
    // De sexta (17/07/2026), 5 dias úteis caem na sexta seguinte — não no dia 22.
    const sexta = new Date(2026, 6, 17);
    expect(sexta.getDay()).toBe(5);
    const destino = somarUteis(sexta, 5);
    expect(destino.getDay()).toBe(5);
    expect(destino.getDate()).toBe(24);
  });

  it('distribui as horas pelos pesos sem perder nem inventar hora', () => {
    const pesos = planoAutomatico([]).map(([, , p]) => p);
    const horas = distribuir(48, pesos);
    expect(horas.reduce((a, b) => a + b, 0)).toBe(48);
    expect(horas.every((h) => Number.isInteger(h))).toBe(true);
  });

  it('sem total informado, deriva as horas do peso de cada etapa', () => {
    expect(distribuir(0, [2, 1.5, 0.5])).toEqual([4, 3, 1]);
  });

  it('sempre inclui abertura e encerramento no plano automático', () => {
    const etapas = planoAutomatico([]).map(([e]) => e);
    expect(etapas[0]).toBe('Abertura + Parametrização inicial');
    expect(etapas[etapas.length - 1]).toBe('Encerramento');
  });
});
