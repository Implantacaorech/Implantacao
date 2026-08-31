import { situacaoVisita } from './bi-implantacao.constants';

/** A leitura é pelo RÓTULO devolvido pela consulta (que o Administrador pode reescrever no
 * Consultas BD), não pelo código do banco — daí valer a pena travá-la em teste. */
describe('situacaoVisita', () => {
  it('reconhece as três situações do Portal', () => {
    expect(situacaoVisita('Sim')).toBe('sim');
    expect(situacaoVisita('Com ressalva')).toBe('ressalva');
    expect(situacaoVisita('Não')).toBe('nao');
  });

  it('ignora caixa e espaços em volta', () => {
    expect(situacaoVisita('  SIM ')).toBe('sim');
    expect(situacaoVisita('COM RESSALVA')).toBe('ressalva');
    expect(situacaoVisita(' com ressalva  ')).toBe('ressalva');
  });

  it('rótulo desconhecido ou vazio cai em "nao" — o painel não quebra', () => {
    expect(situacaoVisita('')).toBe('nao');
    expect(situacaoVisita('Pendente')).toBe('nao');
    // 'Com ressal' foi o truncamento em 10 caracteres que existiu no envio por e-mail:
    // se voltar, o rótulo deixa de ser reconhecido em vez de virar ressalva por engano.
    expect(situacaoVisita('Com ressal')).toBe('nao');
  });
});
