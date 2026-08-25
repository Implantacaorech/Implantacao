import { ConexaoPortalService } from './conexao-portal.service';
import { ConexaoSiclaService } from './conexao-sicla.service';
import { ConexoesService } from './conexoes.service';

function montar(over: { configurado?: boolean; executar?: jest.Mock } = {}) {
  const configurado = over.configurado ?? true;
  const executarSql =
    over.executar ??
    jest.fn().mockResolvedValue({
      ok: true,
      mensagem: '',
      colunas: ['VIVO'],
      linhas: [{ VIVO: 1 }],
    });

  const salvarSicla = jest.fn((d: Record<string, unknown>) => d);
  const salvarPortal = jest.fn((d: Record<string, unknown>) => d);

  const sicla = {
    configurado: () => configurado,
    carregarConfig: () => ({
      tipo: 'oracle',
      host: 'srv',
      porta: '1521',
      banco: 'SICLA',
      usuario: 'painel_ro',
      senha: 'super-secreta',
      url: '',
      select: 'SELECT 1',
      selectTecnicos: '',
      oracleLibDir: '',
      ativo: true,
      oracleThick: true,
    }),
    salvarConfig: salvarSicla,
    sqlDeConfiguracao: () => '',
    executarSql,
  } as unknown as ConexaoSiclaService;

  const portal = {
    configurado: () => configurado,
    carregarConfig: () => ({
      host: 'p',
      porta: '3306',
      banco: 'portal',
      usuario: 'u',
      senha: '',
      url: '',
      ativo: true,
    }),
    salvarConfig: salvarPortal,
    executarSql,
  } as unknown as ConexaoPortalService;

  return {
    servico: new ConexoesService(sicla, portal),
    salvarSicla,
    executarSql,
  };
}

/** O roteador das conexões é o que o **Portal API** administra: é lá que a credencial do
 * banco é cadastrada, e é a única instância que a tem. O que estes testes protegem é o que
 * não pode escapar dessa tela — a senha. */
describe('ConexoesService — configuração das conexões', () => {
  it('a configuração volta SEM a senha, com o sinal de que existe uma', () => {
    const { servico } = montar();
    const sicla = servico.configuracoes().find((c) => c.chave === 'sicla');
    expect(JSON.stringify(sicla)).not.toContain('super-secreta');
    expect(sicla?.temSenha).toBe(true);
    expect(sicla?.campos.usuario).toBe('painel_ro');
  });

  it('conexão sem senha gravada é distinguível de conexão com senha', () => {
    const { servico } = montar();
    const portal = servico
      .configuracoes()
      .find((c) => c.chave === 'portal_rech');
    expect(portal?.temSenha).toBe(false);
  });

  it('salvar delega ao dono da conexão e devolve o estado já sem senha', () => {
    const { servico, salvarSicla } = montar();
    const r = servico.salvarConfiguracao('sicla', { host: 'novo', senha: 'x' });
    expect(salvarSicla).toHaveBeenCalledWith({ host: 'novo', senha: 'x' });
    expect(JSON.stringify(r)).not.toContain('super-secreta');
  });

  it('testar abre a conexão e roda o SELECT de vida', async () => {
    const { servico, executarSql } = montar();
    const r = await servico.testarConexao('sicla');
    expect(r.ok).toBe(true);
    expect(r.mensagem).toContain('respondeu');
    // O SELECT de vida não toca em tabela nenhuma: prova a CREDENCIAL, não o privilégio.
    const sql = String(executarSql.mock.calls[0][0]);
    expect(sql).toMatch(/SELECT 1/i);
    expect(sql).not.toMatch(/SICLA\.|POWERBI\./i);
  });

  it('conexão não cadastrada devolve o motivo, não uma exceção', async () => {
    // Erro de credencial é resposta legítima desta rota — lançar faria a tela mostrar
    // "erro interno" para um caso que o próprio Administrador acabou de causar.
    const { servico } = montar({ configurado: false });
    const r = await servico.testarConexao('sicla');
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain('não configurada');
  });

  it('falha do banco vira mensagem do banco, não "ok: false" mudo', async () => {
    const executar = jest.fn().mockResolvedValue({
      ok: false,
      mensagem: 'ORA-01017: invalid username/password',
      colunas: [],
      linhas: [],
    });
    const { servico } = montar({ executar });
    const r = await servico.testarConexao('sicla');
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain('ORA-01017');
  });
});
