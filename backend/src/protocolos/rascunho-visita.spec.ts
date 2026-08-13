import { Protocolo } from '../database/entities/protocolo.entity';
import { montarRascunhoVisita } from './rascunho-visita';

/** Fábrica de um protocolo mínimo, só com os campos que o rascunho consome. */
function proto(over: Partial<Protocolo> = {}): Protocolo {
  return {
    id: 7,
    cliente: 'ACME Ltda',
    clienteCodigo: '5001',
    titulo: 'Treinamento de Faturamento',
    modulo: 'Fiscal',
    menu: '1.4-I',
    mapaLocutores: JSON.stringify({ P1: 'Ivian', P2: 'Cliente João' }),
    menusAbordados:
      '### 1.4-I — Emissão de NF-e\nObjetivo: emitir\n### 3.4-L — Consulta\nObjetivo: consultar',
    processos: 'Emissão de NF-e de venda',
    pendenciasTreinamento: 'Cadastrar naturezas de operação faltantes',
    proximosPassos: 'Agendar simulação do faturamento',
    pontosAtencao: 'Verificar certificado A1 vencendo',
    duracaoSeg: 3600,
    criadoEm: new Date('2026-08-10T14:00:00'),
    videoOrigem: 'gravacao',
    status: 'Aprovado',
    ...over,
  } as Protocolo;
}

describe('montarRascunhoVisita', () => {
  it('lista os participantes a partir do mapa de locutores', () => {
    const r = montarRascunhoVisita(proto());
    expect(r.participantes).toEqual(['Ivian', 'Cliente João']);
    expect(r.atividade.descricaoAtividade).toContain('- PARTICIPANTES:\nIvian');
  });

  it('monta a descrição no molde do Portal (3 blocos)', () => {
    const d = montarRascunhoVisita(proto()).atividade.descricaoAtividade;
    expect(d).toContain('- PARTICIPANTES:');
    expect(d).toContain('- ROTINAS:');
    expect(d).toContain('- TAREFAS/OBSERVAÇÕES:');
    // As rotinas saem dos cabeçalhos ### de menusAbordados, sem o corpo.
    expect(d).toContain('1.4-I — Emissão de NF-e');
    expect(d).toContain('3.4-L — Consulta');
    expect(d).not.toContain('Objetivo: emitir');
    // Tarefas juntam pendências + próximos passos + pontos de atenção.
    expect(d).toContain('Cadastrar naturezas de operação faltantes');
    expect(d).toContain('Agendar simulação do faturamento');
    expect(d).toContain('Verificar certificado A1 vencendo');
  });

  it('sugere início/fim a partir da criação e da duração', () => {
    const r = montarRascunhoVisita(proto());
    expect(r.dataInicioSugerida).toBe('2026-08-10T14:00');
    expect(r.dataFimSugerida).toBe('2026-08-10T15:00'); // +3600s
  });

  it('cai no menu principal quando não há menus abordados', () => {
    const r = montarRascunhoVisita(
      proto({ menusAbordados: '', processos: '' }),
    );
    expect(r.atividade.descricaoAtividade).toContain('- ROTINAS:\n1.4-I');
  });

  it('não inventa menu quando o principal é o placeholder de "não identificado"', () => {
    const r = montarRascunhoVisita(
      proto({
        menusAbordados: '',
        processos: '',
        menu: 'Menu não identificado - revisar manualmente',
      }),
    );
    // Bloco ROTINAS fica vazio (linha em branco), sem repetir o placeholder.
    expect(r.atividade.descricaoAtividade).not.toContain('não identificado');
  });

  it('sem locutores nomeados, participantes fica vazio', () => {
    const r = montarRascunhoVisita(proto({ mapaLocutores: '' }));
    expect(r.participantes).toEqual([]);
  });

  it('duração zero: fim sugerido igual ao início', () => {
    const r = montarRascunhoVisita(proto({ duracaoSeg: 0 }));
    expect(r.dataFimSugerida).toBe(r.dataInicioSugerida);
  });
});
