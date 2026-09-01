import { Routes } from '@angular/router';
import { ROTAS_PORTAL_API, rotasDe, routes } from './app.routes';

/** O que o **Portal API** NÃO tem é a garantia que o usuário pediu: *"os demais módulos não
 * importa e não queremos que tenha dentro do portal"*. Esconder o item de menu não bastava —
 * a rota continuava lá, alcançável digitando o endereço. Agora a tabela é outra, e este
 * teste é o que impede alguém de "só acrescentar uma telinha" nela. */
function caminhos(tabela: Routes): string[] {
  const achados: string[] = [];
  const andar = (rs: Routes, prefixo = '') => {
    for (const r of rs) {
      const p = [prefixo, r.path ?? ''].filter(Boolean).join('/');
      if (r.path !== undefined) achados.push(p);
      if (r.children) andar(r.children, p);
    }
  };
  andar(tabela);
  return achados;
}

describe('tabela de rotas por instância', () => {
  it('o Portal API tem SÓ as telas de conexão, API e token (mais login e perfil)', () => {
    expect(caminhos(ROTAS_PORTAL_API).sort()).toEqual(
      [
        '',
        // duas vezes: a raiz do shell e o redirect que ela faz para a tela da API.
        '',
        'config/conexoes',
        'config/api-dados',
        'config/tokens',
        'config/api-dados/consulta',
        'config/api-dados/consulta/:slug',
        'config/consultas-bd',
        'config/consultas-bd/:slug',
        'esqueci-senha',
        'login',
        'perfil',
        '**',
      ].sort(),
    );
  });

  it('nenhum módulo de negócio do Painel existe no Portal API', () => {
    const p = caminhos(ROTAS_PORTAL_API);
    for (const ausente of [
      'home',
      'projetos',
      'matriz',
      'bi',
      'usuarios',
      'permissoes',
      // O lado CONSUMIDOR é do Painel: o Portal API não consome, ele executa.
      'config/tokens-api',
    ]) {
      expect(p).not.toContain(ausente);
    }
  });

  it('administrar a API não existe mais no Painel — só colar o token', () => {
    // Decisão do usuário em 2026-08-26: "o uso será único e exclusivo no Portal API".
    // O Painel perdeu a conexão com banco, o Consultas BD e a API de Dados; ficou com a
    // tela onde se cola o token gerado lá.
    const p = caminhos(routes);
    for (const ausente of [
      'config/disponibilidade',
      'config/consultas-bd',
      'config/consultas-bd/:slug',
      'config/api-dados',
      'config/api-dados/consulta',
      'config/conexoes',
      'config/tokens',
    ]) {
      expect(p).not.toContain(ausente);
    }
    expect(p).toContain('config/tokens-api');
  });

  it('cada item do menu do Portal API é uma TELA, não uma âncora', () => {
    // Com âncora, clicar em Conexões, Consultas ou Tokens mostrava exatamente o mesmo
    // conteúdo — foi o que o usuário reportou. Cada rota carrega a sua seção.
    const secoes = ROTAS_PORTAL_API.flatMap((r) => r.children ?? [])
      .filter((r) => r.data?.['secao'])
      .map((r) => [r.path, r.data?.['secao']]);
    expect(secoes).toEqual([
      ['config/conexoes', 'conexoes'],
      ['config/api-dados', 'consultas'],
      ['config/tokens', 'tokens'],
    ]);
  });

  it('rotasDe escolhe a tabela pelo perfil', () => {
    expect(rotasDe('portal-api')).toBe(ROTAS_PORTAL_API);
    expect(rotasDe('painel')).toBe(routes);
  });
});
