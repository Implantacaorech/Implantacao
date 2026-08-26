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
  it('o Portal API tem SÓ login, as três telas e o perfil', () => {
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
      'consultor-siger',
      'config/consultas-bd',
      'config/tokens-api',
    ]) {
      expect(p).not.toContain(ausente);
    }
  });

  it('a tela de CONEXÃO com banco não existe mais no Painel', () => {
    // Decisão do usuário em 2026-08-26: dado de conexão vive no Portal API; aqui entra, no
    // lugar dele, a vinculação dos tokens.
    const p = caminhos(routes);
    expect(p).not.toContain('config/disponibilidade');
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
