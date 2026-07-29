import {
  montarDados,
  montarDocumento,
  normalizarDoc,
  templateExiste,
} from './gerar-projeto-implantacao';
import {
  SnapshotDocx,
  carregarSnapshotDocx,
  extrairDocx,
} from './comparacao-docx';
import { seTiverInsumo } from '../common/insumo-local';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_projeto_implantacao.json`).
 *
 * É o gerador mais invasivo do conjunto: remove seções inteiras do template oficial, clona
 * parágrafos e linhas de tabela e reescreve trechos dentro das runs. Por isso o teste cobre
 * o documento inteiro, incluindo cabeçalhos e rodapés. */
seTiverInsumo(
  'tools',
  'templates',
  'base_projeto_tokenizado.docx',
)(
  'gerar-projeto-implantacao (porte de tools/gerar_projeto_implantacao.py)',
  () => {
    const esperado = carregarSnapshotDocx('gerar_projeto_implantacao');
    let atual: SnapshotDocx;

    beforeAll(async () => {
      atual = await extrairDocx(await montarDocumento());
    }, 30000);

    it('produz a mesma quantidade de parágrafos que o original', () => {
      expect(atual.paragrafos.length).toBe(esperado.paragrafos.length);
    });

    it('reproduz cada parágrafo do corpo, na ordem', () => {
      expect(atual.paragrafos).toEqual(esperado.paragrafos);
    });

    it('reproduz as 3 tabelas, célula a célula', () => {
      expect(atual.tabelas.length).toBe(3);
      expect(atual.tabelas).toEqual(esperado.tabelas);
    });

    it('preserva o cabeçalho e o rodapé do template oficial (o timbre)', () => {
      expect(atual.cabecalhos['word/header1.xml']).toEqual(
        esperado.cabecalhos['word/header1.xml'],
      );
      expect(atual.rodapes['word/footer1.xml']).toEqual(
        esperado.rodapes['word/footer1.xml'],
      );
    });

    it('não replica as partes vazias que o python-docx cria por efeito colateral', () => {
      // DIVERGÊNCIA CONSCIENTE do porte. O template tem UM cabeçalho e UM rodapé. O gerador
      // Python acaba com três de cada porque `clean_markers` percorre `sec.first_page_header`
      // e `sec.even_page_header`, e no python-docx só LER essas propriedades já cria a parte
      // e a referência no `sectPr`.
      //
      // Verificado que o efeito é inerte: o cabeçalho "first" só vale com `<w:titlePg/>` e o
      // "even" só com `evenAndOddHeaders` no settings.xml — nenhum dos dois existe no
      // documento, então o Word ignora as duas referências. As partes saem vazias.
      //
      // Reproduzir isso seria copiar um acidente para dentro do documento oficial do cliente.
      // O teste registra a diferença para que ela seja uma decisão visível, não um descuido.
      const extrasEsperadas = Object.entries(esperado.cabecalhos)
        .filter(([nome]) => nome !== 'word/header1.xml')
        .concat(
          Object.entries(esperado.rodapes).filter(
            ([nome]) => nome !== 'word/footer1.xml',
          ),
        );
      expect(extrasEsperadas.length).toBe(4);
      for (const [, paragrafos] of extrasEsperadas) {
        expect(paragrafos.join('')).toBe('');
      }
      expect(Object.keys(atual.cabecalhos)).toEqual(['word/header1.xml']);
      expect(Object.keys(atual.rodapes)).toEqual(['word/footer1.xml']);
    });

    it('não deixa nenhum token {{...}} por preencher no documento', () => {
      // Token que sobrasse iria para o cliente como "{{crono_inicio}}".
      const sobrando = atual.paragrafos.filter((p) =>
        /\{\{[a-z0-9_]+\}\}/.test(p),
      );
      expect(sobrando).toEqual([]);
    });

    it('corrige o typo "Da de Início" que existe no template', () => {
      const todos = [...atual.paragrafos, ...atual.tabelas.flat(2)].join('\n');
      expect(todos).toContain('Data de Início do Uso oficial');
      expect(todos).not.toContain('Da de Início do Uso oficial');
    });

    it('depende do template tokenizado — sua ausência impede a geração', () => {
      expect(templateExiste()).toBe(true);
    });
  },
);

describe('regras de montagem dos dados do Projeto', () => {
  it('transforma lista do YAML em texto de várias linhas (um bullet por item)', () => {
    const d = montarDados({ objetivos: ['Reduzir retrabalho', 'Padronizar'] });
    expect(d.campos.objetivos).toBe('Reduzir retrabalho\nPadronizar');
  });

  it('sem areas_incluidas, inclui só as áreas que têm algum subcampo preenchido', () => {
    const d = montarDados({ vendas_detalhamento: 'Pedido e faturamento' });
    expect(d.areasIncluidas).toEqual(['vendas']);
  });

  it('respeita areas_incluidas quando o YAML a informa', () => {
    const d = montarDados({
      vendas_detalhamento: 'x',
      areas_incluidas: ['livros'],
    });
    expect(d.areasIncluidas).toEqual(['livros']);
  });

  it('normaliza título para comparar com o template (sem acento, sem pontuação nas pontas)', () => {
    expect(normalizarDoc('  Gestão Comercial ')).toBe('gestao comercial');
    expect(normalizarDoc('Redator do Projeto:')).toBe('redator do projeto');
  });
});
