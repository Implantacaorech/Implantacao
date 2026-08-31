import { describe, expect, it } from 'vitest';
import { Projeto } from '../../core/models/projeto.model';
import { camposEditaveis, secoes, valores } from './doc-edit-spec';

function projeto(extra: Partial<Projeto> = {}): Projeto {
  return {
    id: 1,
    cliente: 'Cliente Teste LTDA',
    cnpj: '00.000.000/0001-00',
    modulos: 'FAT',
    observacoes: '',
    gci: '',
    consultor: '',
    horasCobradas: '',
    horasBonificadas: '',
    ...extra,
  } as Projeto;
}

/** Todos os campos de uma seção, achatados. */
function campos(doc: 'levantamento' | 'projeto', p = projeto()) {
  return secoes(doc, p).flatMap((s) => (s.tipo === 'tabela' ? [] : s.campos));
}

describe('doc-edit-spec — Cronograma Macro é campo de data', () => {
  const CRONO = [
    'crono_levantamento',
    'crono_cronograma',
    'crono_parametrizacao',
    'crono_treinamento',
    'crono_simulacao',
    'crono_inicio',
    'crono_finalizacao',
  ];

  it('os sete períodos do Cronograma Macro são do tipo data', () => {
    const porChave = new Map(campos('projeto').map((c) => [c.chave, c]));
    for (const chave of CRONO) {
      expect(porChave.get(chave)?.tipo, chave).toBe('data');
    }
  });

  it('o rótulo perdeu o sufixo "— período", que não faz sentido num seletor de data', () => {
    const rotulos = campos('projeto')
      .filter((c) => CRONO.includes(c.chave))
      .map((c) => c.label);
    expect(rotulos).toContain('Levantamento de requisitos');
    expect(rotulos.some((r) => r.includes('período'))).toBe(false);
  });

  it('valor já em ISO passa direto para o input de data', () => {
    const v = valores('projeto', projeto(), { crono_inicio: '2026-11-01' });
    expect(v['crono_inicio']).toBe('2026-11-01');
  });

  it('valor antigo em dd/mm/aaaa é convertido, em vez de sumir da tela', () => {
    // Projetos anteriores à mudança gravaram a data à mão. Sem a conversão o campo abriria
    // vazio e a primeira gravação apagaria o que estava lá.
    const v = valores('projeto', projeto(), { crono_inicio: '01/11/2026' });
    expect(v['crono_inicio']).toBe('2026-11-01');
  });

  it('valor que não é uma data reconhecível vira vazio — o input de data não o exibiria', () => {
    const v = valores('projeto', projeto(), { crono_inicio: '01/11 a 15/11' });
    expect(v['crono_inicio']).toBe('');
  });

  it('a conversão não alcança campos que não são de data', () => {
    const v = valores('projeto', projeto(), { objetivos: '10/08/2026 foi a reunião' });
    expect(v['objetivos']).toBe('10/08/2026 foi a reunião');
  });
});

describe('doc-edit-spec — bloco Cadastros do layout do Projeto', () => {
  it('os três pontos do bloco existem como campo editável', () => {
    const editaveis = camposEditaveis('projeto', projeto());
    expect(editaveis).toContain('cad_clientes');
    expect(editaveis).toContain('cad_produtos');
    expect(editaveis).toContain('cad_outros');
  });

  it('não são pré-preenchidos pela ficha: são definições alinhadas com o cliente', () => {
    const v = valores('projeto', projeto({ observacoes: 'Observação do fechamento' }), {});
    expect(v['cad_clientes']).toBe('');
    expect(v['cad_produtos']).toBe('');
    expect(v['cad_outros']).toBe('');
  });
});

describe('doc-edit-spec — Tabela de Usuários acompanha o Levantamento', () => {
  it('Projeto e Levantamento têm a mesma quantidade de linhas de usuário', () => {
    const linhas = (doc: 'levantamento' | 'projeto') => {
      const tab = secoes(doc, projeto()).find((s) => s.tipo === 'tabela' && s.prefixo === 'usu');
      return tab && tab.tipo === 'tabela' ? tab.linhas : 0;
    };
    // Com 4 no Projeto e 5 no Levantamento, o 5º usuário-chave herdado sumia sem aviso.
    expect(linhas('projeto')).toBe(linhas('levantamento'));
    expect(linhas('projeto')).toBe(5);
  });
});
