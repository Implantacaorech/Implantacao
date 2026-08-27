import { readFileSync } from 'fs';
import { join } from 'path';
import { MENUS, MENU_CHAVES, PADRAO_PERMISSOES } from './menus';

/** O CATÁLOGO DE MENUS × O MENU DE VERDADE.
 *
 * A tabela de permissões é o que o Administrador vê para liberar acesso. Quando uma tela sai
 * do Painel e a chave dela fica para trás, ele libera algo que não existe; quando entra uma
 * tela e ninguém acrescenta a chave, ela não aparece para ser liberada. Foi o que aconteceu
 * em 2026-08-26, quando Consultas BD e API de Dados mudaram para o Portal API e a tela de
 * Tokens entrou no lugar — e nada disso apareceu na tabela até alguém reparar.
 *
 * Este teste lê o MENU DE VERDADE (o shell do Angular) e cobra a correspondência. */
const SHELL = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'app',
  'layouts',
  'shell',
  'shell.component.html',
);
const shellInteiro = readFileSync(SHELL, 'utf8');

/** O shell carrega os DOIS menus no mesmo arquivo — o do Portal API e o do Painel, num
 * `@if (portalApi()) { … } @else { … }`. Comparar contra o arquivo inteiro daria falso
 * positivo: Consultas BD existe lá, só que na OUTRA instância. */
function so(qual: 'portal-api' | 'painel'): string {
  const nav = shellInteiro.slice(
    shellInteiro.indexOf('<nav class="side-nav">'),
  );
  const abre = nav.indexOf('@if (portalApi()) {');
  const senao = nav.indexOf('} @else {', abre);
  const fecha = nav.indexOf('</nav>', senao);
  expect(abre).toBeGreaterThan(-1);
  expect(senao).toBeGreaterThan(abre);
  return qual === 'portal-api'
    ? nav.slice(abre, senao)
    : nav.slice(senao, fecha);
}
const shell = so('painel');

/** O grupo Sistema é fixo no shell (não passa por `podeVer`), então a correspondência com a
 * tabela precisa ser declarada aqui — e é esta declaração que alguém tem de mexer ao
 * acrescentar ou tirar uma tela. `null` = a chave NÃO é uma tela deste Painel. */
const SISTEMA: Record<string, string | null> = {
  ferramentas: 'routerLink="/ferramentas"',
  usuarios: 'routerLink="/usuarios"',
  checklist: "['/cadastros', 'checklist']",
  indice_topicos: "['/cadastros', 'indice']",
  modelos_docs: "['/cadastros', 'modelos']",
  tokens_api: 'routerLink="/config/tokens-api"',
  assistente_legado: 'routerLink="/legado"',
  prontidao: 'routerLink="/prontidao"',
  // PORTÃO, não tela. Consultas BD mudou para o Portal API em 2026-08-26; a chave ficou
  // porque o que ela controla é quem, entrando por JWT, pode CHAMAR uma consulta publicada
  // pela tela (`MENU_CONSULTA_DE_TELA`). Apagá-la desligaria liberações já gravadas.
  consulta_bd: null,
};

describe('catálogo de menus (tabela de permissões)', () => {
  it('não repete chave', () => {
    expect(MENU_CHAVES.length).toBe(new Set(MENU_CHAVES).size);
  });

  it('toda chave tem um padrão por perfil — senão nasce invisível para todo mundo', () => {
    const semPadrao = MENU_CHAVES.filter((c) => !PADRAO_PERMISSOES[c]);
    expect(semPadrao).toEqual([]);
  });

  it('não há padrão para chave que não existe mais', () => {
    const orfaos = Object.keys(PADRAO_PERMISSOES).filter(
      (c) => !MENU_CHAVES.includes(c),
    );
    expect(orfaos).toEqual([]);
  });

  it('todo menu de Execução/Gestão é consultado pelo shell', () => {
    // Esses dois grupos são dirigidos por `podeVer('chave')`. Uma chave que ninguém consulta
    // é uma linha na tabela que não liga nada.
    const usadas = new Set(
      [...shell.matchAll(/pode[A-Za-z]*\(\)/g)].map((m) => m[0]),
    );
    const ts = readFileSync(SHELL.replace(/\.html$/, '.ts'), 'utf8');
    const declaradas = new Set(
      [...ts.matchAll(/podeVer\('([a-z_]+)'\)/g)].map((m) => m[1]),
    );
    const semUso = MENUS.filter(
      (m) =>
        (m.grupo === 'Execução' || m.grupo === 'Gestão') &&
        !m.fixaAdm &&
        !declaradas.has(m.chave),
    ).map((m) => m.chave);
    expect(semUso).toEqual([]);
    expect(usadas.size).toBeGreaterThan(0);
  });

  it('o shell não consulta chave que a tabela desconhece', () => {
    const ts = readFileSync(SHELL.replace(/\.html$/, '.ts'), 'utf8');
    const inventadas = [...ts.matchAll(/podeVer\('([a-z_]+)'\)/g)]
      .map((m) => m[1])
      .filter((c) => !MENU_CHAVES.includes(c));
    expect(inventadas).toEqual([]);
  });

  it('o portão das consultas publicadas pela tela é LIBERÁVEL, não fixo em ADM', () => {
    // Enquanto era `fixaAdm`, só o Administrador conseguia chamar por login uma consulta
    // publicada pela tela — e isso esvaziava o caminho inteiro: publica-se uma consulta para
    // o time usar, e o time não alcança.
    const def = MENUS.find((m) => m.chave === 'consulta_bd');
    expect(def?.fixaAdm).toBeFalsy();
  });

  it('mas o PADRÃO continua só ADM — abrir é decisão de quem administra', () => {
    // Liberar por default abriria acesso a dado de terceiro sem ninguém ter decidido.
    expect(Object.keys(PADRAO_PERMISSOES.consulta_bd)).toEqual(['ADM']);
  });

  it('cada menu de Sistema é uma tela do shell — ou está declarado como portão', () => {
    const doCatalogo = MENUS.filter((m) => m.grupo === 'Sistema')
      .map((m) => m.chave)
      .sort();
    expect(doCatalogo).toEqual(Object.keys(SISTEMA).sort());

    for (const [chave, link] of Object.entries(SISTEMA)) {
      if (link === null) continue;
      expect(`${chave}: ${shell.includes(link)}`).toBe(`${chave}: true`);
    }
  });

  it('o que foi declarado PORTÃO não tem mesmo tela no Painel', () => {
    // Se alguém trouxer Consultas BD de volta ao Painel, esta declaração fica mentindo — e o
    // teste avisa em vez de deixar a tabela dizer uma coisa e o menu outra.
    expect(shell).not.toContain('/config/consultas-bd');
    expect(shell).not.toContain('/config/api-dados');
  });

  it('e continua existindo no PORTAL API, que é para onde ela foi', () => {
    // O outro lado da mesma verdade: a chave só faz sentido enquanto a tela existe em
    // ALGUM lugar. Se sumir dos dois, ela vira liberação de coisa nenhuma.
    expect(so('portal-api')).toContain('/config/consultas-bd');
  });
});
