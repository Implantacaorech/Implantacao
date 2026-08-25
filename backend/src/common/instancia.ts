/** QUAL DAS DUAS INSTÂNCIAS este processo é.
 *
 * O mesmo binário sobe de dois jeitos (ver `docs/portal-conexoes.md`):
 *
 * - **`painel`** — o Portal Implantação, com todo o sistema. `dist/main.js`.
 * - **`portal-api`** — o Portal API: a instância INTERNA que guarda a credencial de banco
 *   e serve só a API de Dados. `dist/main-dados.js`.
 *
 * O front-end usa isto para montar o menu certo: no Portal API só existem conexão de banco,
 * criação de consulta e geração de token — decisão do usuário em 2026-08-25 ("é apenas isso
 * que deve ter dentro do painel"). Servir o menu inteiro numa instância que não tem os
 * endpoints por trás dele seria oferecer porta que não abre.
 *
 * A variável de ambiente é escrita pelo próprio entrypoint, antes de o Nest subir — não é
 * configuração de operação, é identidade do processo. */
export type PerfilInstancia = 'painel' | 'portal-api';

export const VAR_PERFIL = 'MIGRACAO_PERFIL_INSTANCIA';

/** Como cada perfil se apresenta a quem abre o navegador. */
export const INSTANCIAS: Record<
  PerfilInstancia,
  { nome: string; descricao: string; rotaInicial: string }
> = {
  painel: {
    nome: 'Painel de Implantação',
    descricao: 'O sistema de implantação da Rech.',
    rotaInicial: '/home',
  },
  'portal-api': {
    nome: 'Portal API',
    descricao:
      'Instância interna: conexão com os bancos, criação das consultas da API e geração dos tokens.',
    rotaInicial: '/config/api-dados',
  },
};

/** Perfil deste processo. Qualquer valor não reconhecido vira `painel` — o padrão seguro é
 * o sistema completo, porque um Painel que se acha Portal API esconderia o menu de todo
 * mundo, e isso é bem mais visível que o contrário. */
export function perfilDaInstancia(): PerfilInstancia {
  return (process.env[VAR_PERFIL] ?? '').trim() === 'portal-api'
    ? 'portal-api'
    : 'painel';
}
