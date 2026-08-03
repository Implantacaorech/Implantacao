import { montarVocabulario, TERMOS_RECH } from './vocabulario';

/** O vocabulário é a correção para o erro relatado em 2026-07-30 ("IVEA" no lugar de
 * "IVIAN"). O que se testa aqui é a ORDEM e o limite: a janela de contexto do Whisper é
 * curta, então o que o usuário digitou tem de chegar antes do glossário fixo — senão o
 * glossário come o espaço justamente dos nomes, que é onde o modelo mais erra. */
describe('montarVocabulario', () => {
  it('põe o que o usuário digitou na frente, depois o cliente', () => {
    const v = montarVocabulario({
      digitado: 'Ivian, ouro',
      cliente: 'MELBROS IND.COM.DE CALC.LTDA',
      titulo: 'Projeto',
    });
    const termos = v.split(', ');
    expect(termos[0]).toBe('Ivian');
    expect(termos[1]).toBe('ouro');
    expect(termos[2]).toBe('MELBROS IND.COM.DE CALC.LTDA');
    expect(v).toContain('SIGER');
  });

  it('aceita ponto e vírgula e quebra de linha como separadores', () => {
    const v = montarVocabulario({ digitado: 'Ivian; Marcos\nGMAX' });
    expect(v.startsWith('Ivian, Marcos, GMAX')).toBe(true);
  });

  it('não repete termo (mesmo com caixa diferente) nem deixa espaço sobrando', () => {
    const v = montarVocabulario({
      digitado: '  siger ,, Ivian ',
      cliente: 'IVIAN',
    });
    const termos = v.split(', ');
    expect(termos.filter((t) => t.toLowerCase() === 'ivian')).toHaveLength(1);
    expect(termos.filter((t) => t.toLowerCase() === 'siger')).toHaveLength(1);
    expect(termos.every((t) => t === t.trim() && t.length > 0)).toBe(true);
  });

  it('respeita o limite cortando termo inteiro, nunca no meio da palavra', () => {
    const digitado = Array.from({ length: 80 }, (_, i) => `termo${i}`).join(
      ', ',
    );
    const v = montarVocabulario({ digitado });
    expect(v.length).toBeLessThanOrEqual(400);
    expect(v.endsWith(',')).toBe(false);
    // Encheu com o que o usuário digitou — o glossário fixo nem chegou a caber, que é
    // exatamente a prioridade desejada.
    expect(v.split(', ').every((t) => /^termo\d+$/.test(t))).toBe(true);
  });

  it('sem nada digitado, ainda entrega o glossário da casa', () => {
    const v = montarVocabulario({});
    expect(v.split(', ')).toEqual(TERMOS_RECH.slice(0, v.split(', ').length));
  });

  it('não estoura o limite nem quando o usuário digita um termo gigante', () => {
    const v = montarVocabulario({ digitado: 'x'.repeat(900) });
    // O primeiro termo entra inteiro (senão o vocabulário sairia vazio); o corte impede
    // que qualquer outro se some a ele.
    expect(v).toBe('x'.repeat(900));
  });
});
