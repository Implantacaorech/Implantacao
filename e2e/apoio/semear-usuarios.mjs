// Semeia os usuários da instância isolada do e2e (A19) — reproduzível, para o CI e para quem
// roda à mão. Pré-requisito: o ADM já existe (via `npm run seed:admin -- --login=adm
// --senha=Teste@123 --email=adm@rech.com.br`) e a instância descartável está no ar na 5199.
//
//   node e2e/apoio/semear-usuarios.mjs
//
// É idempotente: usuário que já existe é pulado. NUNCA aponte para a 5100 (produção) — este
// script CRIA usuários; o guard abaixo recusa a porta de produção, como o playwright.config.
//
// Node puro (fetch nativo do Node 24), sem dependências — roda antes de instalar o Playwright.

const BASE = process.env.PAINEL_E2E_URL ?? 'http://localhost:5199';
const ADM_LOGIN = process.env.E2E_ADM_LOGIN ?? 'adm';
const SENHA = process.env.E2E_SENHA ?? 'Teste@123';

if (/:5100(\/|$)/.test(BASE)) {
  console.error(`RECUSADO: ${BASE} é a porta 5100 (PRODUÇÃO). Use a instância isolada (5199).`);
  process.exit(1);
}

/** Logins por papel (os que `entrar()` usa) + os nomes das designações que `projetoNoPasso`
 * espera (Gabriel GCI, Cesar Consultor, Lucia Levantadora). codigoSicla é obrigatório e aqui é
 * só um número de fachada — a instância é descartável. */
const USUARIOS = [
  { login: 'comercial', nome: 'Comercial Teste', perfil: 'Comercial', codigoSicla: '9001' },
  { login: 'administrativo', nome: 'Administrativo Teste', perfil: 'Administrativo', codigoSicla: '9002' },
  { login: 'coordenador', nome: 'Coordenador Teste', perfil: 'Coordenador', codigoSicla: '9003' },
  { login: 'gci', nome: 'GCI Teste', perfil: 'GCI', codigoSicla: '9004' },
  { login: 'consultor', nome: 'Consultor Teste', perfil: 'Consultor', codigoSicla: '9005' },
  { login: 'levantador', nome: 'Levantador Teste', perfil: 'Levantador', codigoSicla: '9006' },
  // Nomes usados nas designações de projetoNoPasso — precisam existir com o papel certo.
  { login: 'gabriel.gci', nome: 'Gabriel GCI', perfil: 'GCI', codigoSicla: '9104' },
  { login: 'cesar.consultor', nome: 'Cesar Consultor', perfil: 'Consultor', codigoSicla: '9105' },
  { login: 'lucia.levantadora', nome: 'Lucia Levantadora', perfil: 'Levantador', codigoSicla: '9106' },
  // Dois CLIENTES (papel externo, 2026-08-31): cada um amarrado a um código de cliente do
  // SICLA diferente. São dois de propósito — o que o e2e precisa provar é que um não alcança
  // o outro, e isso exige dois. `codigoSicla` fica vazio: cliente não é técnico, e o backend
  // recusa o cadastro que misturar os dois códigos.
  { login: 'cliente.acme', nome: 'Contato ACME', perfil: 'Cliente', codigoClienteSicla: '3180' },
  { login: 'cliente.outro', nome: 'Contato CONCORRENTE', perfil: 'Cliente', codigoClienteSicla: '3729' },
];

const desembrulhar = (j) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: ADM_LOGIN, senha: SENHA }),
  });
  if (!r.ok) throw new Error(`Login do ADM (${ADM_LOGIN}) falhou: HTTP ${r.status}`);
  const j = desembrulhar(await r.json());
  const token = j.accessToken ?? j.token;
  if (!token) throw new Error('Login não devolveu accessToken.');
  return token;
}

async function loginsExistentes(token) {
  const r = await fetch(`${BASE}/api/usuarios`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return new Set();
  const itens = desembrulhar(await r.json())?.itens ?? [];
  return new Set(itens.map((u) => u.login));
}

async function criar(token, u) {
  const r = await fetch(`${BASE}/api/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      login: u.login,
      nome: u.nome,
      email: `${u.login}@teste.local`,
      senha: SENHA,
      perfil: u.perfil,
      // Os dois códigos são excludentes: o do TÉCNICO no cadastro interno, o do CLIENTE no
      // externo. Mandar os dois faz o backend recusar (e é o certo).
      codigoSicla: u.codigoSicla ?? '',
      codigoClienteSicla: u.codigoClienteSicla ?? '',
    }),
  });
  return r.ok;
}

async function main() {
  const token = await login();
  const jaExistem = await loginsExistentes(token);
  let criados = 0;
  for (const u of USUARIOS) {
    if (jaExistem.has(u.login)) {
      console.log(`= ${u.login} (${u.perfil}) já existe`);
      continue;
    }
    const ok = await criar(token, u);
    console.log(`${ok ? '+' : '!'} ${u.login} (${u.perfil}) ${ok ? 'criado' : 'FALHOU'}`);
    if (ok) criados++;
  }

  // Verifica: todos os logins esperados têm de existir ao final (o e2e depende deles).
  const finais = await loginsExistentes(token);
  const faltando = USUARIOS.map((u) => u.login).filter((l) => !finais.has(l));
  if (faltando.length) {
    console.error(`FALHA: usuários ausentes após semear: ${faltando.join(', ')}`);
    process.exit(1);
  }
  console.log(`OK — ${USUARIOS.length} usuários do e2e presentes (${criados} criados agora).`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
