import {
  codigosInexistentesNoTexto,
  codigosValidosDoCatalogo,
  ehCodigoDeMenu,
  validarMenuPrincipal,
} from './validar-menus';
import { MenuCatalogo } from './menus-mencionados';

const catalogo: MenuCatalogo[] = [
  {
    sigla: 'EST',
    codigo: '1.4-I',
    opcao: 'Cadastro de Produtos',
    programa: 'EST101',
  },
  {
    sigla: 'FAT',
    codigo: '2.1-P',
    opcao: 'Emissão de Nota',
    programa: 'FAT201',
  },
  { sigla: 'CTB', codigo: '1.1', opcao: 'Plano de Contas', programa: 'CTB101' },
  // Uma FONTE (não é código de menu) — não deve entrar no conjunto de válidos.
  { sigla: 'EST', codigo: 'BDA001.CBL', opcao: 'fonte', programa: '' },
];

describe('validar-menus (A15)', () => {
  const validos = codigosValidosDoCatalogo(catalogo);

  it('monta o conjunto de válidos só com códigos de menu de verdade', () => {
    expect(validos.has('1.4-I')).toBe(true);
    expect(validos.has('2.1-P')).toBe(true);
    expect(validos.has('1.1')).toBe(true);
    expect(validos.has('BDA001.CBL')).toBe(false); // fonte, não menu
  });

  it('ehCodigoDeMenu reconhece a forma de código', () => {
    expect(ehCodigoDeMenu('1.4-I')).toBe(true);
    expect(ehCodigoDeMenu('1.2-M/I/A')).toBe(true);
    expect(ehCodigoDeMenu('1.1')).toBe(true);
    expect(ehCodigoDeMenu('Cadastro de Produtos')).toBe(false);
    expect(ehCodigoDeMenu('Menu não identificado - revisar manualmente')).toBe(
      false,
    );
  });

  describe('validarMenuPrincipal', () => {
    it('mantém um código que existe no catálogo', () => {
      expect(validarMenuPrincipal('1.4-I', validos)).toEqual({
        menu: '1.4-I',
        rejeitado: null,
      });
    });

    it('rejeita um código inexistente (rebaixa para revisão manual)', () => {
      const r = validarMenuPrincipal('3.4-L', validos);
      expect(r.menu).toBe('Menu não identificado - revisar manualmente');
      expect(r.rejeitado).toBe('3.4-L');
    });

    it('não mexe num nome de tela (não é código)', () => {
      expect(validarMenuPrincipal('Cadastro de Produtos', validos)).toEqual({
        menu: 'Cadastro de Produtos',
        rejeitado: null,
      });
    });

    it('catálogo vazio não valida nada', () => {
      expect(validarMenuPrincipal('9.9-Z', new Set())).toEqual({
        menu: '9.9-Z',
        rejeitado: null,
      });
    });
  });

  describe('codigosInexistentesNoTexto', () => {
    it('lista os códigos citados que não existem, deduplicados', () => {
      const texto =
        '### 1.4-I — Cadastro\nfalou também do 3.4-L e de novo 3.4-L; e do 2.1-P.';
      expect(codigosInexistentesNoTexto(texto, validos)).toEqual(['3.4-L']);
    });

    it('ignora números sem letra (ambíguos: "versão 1.4")', () => {
      expect(
        codigosInexistentesNoTexto('atualizou para a versão 1.4', validos),
      ).toEqual([]);
    });

    it('catálogo vazio → nada', () => {
      expect(codigosInexistentesNoTexto('3.4-L', new Set())).toEqual([]);
    });
  });
});
