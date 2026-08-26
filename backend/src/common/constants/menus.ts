import { Perfil, PERFIS } from './perfis';

/** Nível de liberação de um papel/usuário sobre um menu/tela.
 * - `nada`     → sem acesso (menu escondido, rota bloqueada, API 403).
 * - `consulta` → só leitura (vê a tela; ações de escrita escondidas/bloqueadas).
 * - `alteracao`→ acesso pleno (edita; as regras finas de designação/linha continuam no código). */
export type NivelPermissao = 'nada' | 'consulta' | 'alteracao';
export const NIVEIS: NivelPermissao[] = ['nada', 'consulta', 'alteracao'];
const ORDEM: Record<NivelPermissao, number> = {
  nada: 0,
  consulta: 1,
  alteracao: 2,
};
export function nivelMaior(
  a: NivelPermissao,
  b: NivelPermissao,
): NivelPermissao {
  return ORDEM[a] >= ORDEM[b] ? a : b;
}
/** `nivel` satisfaz o mínimo exigido? (alteracao ⊇ consulta ⊇ nada). */
export function atendeNivel(
  nivel: NivelPermissao,
  minimo: NivelPermissao,
): boolean {
  return ORDEM[nivel] >= ORDEM[minimo];
}

export type GrupoMenu = 'Execução' | 'Gestão' | 'Sistema';

export interface DefinicaoMenu {
  chave: string;
  rotulo: string;
  grupo: GrupoMenu;
  /** Telas de configuração do sistema — mantidas fixas em ADM nesta 1ª entrega do painel
   * de permissões (mostradas, mas não editáveis, por segurança). */
  fixaAdm?: boolean;
}

/** Catálogo dos menus/telas controlados pelo painel de permissões. Espelha o menu do
 * frontend (shell) e as telas que discutimos em 2026-07-28. */
export const MENUS: DefinicaoMenu[] = [
  { chave: 'novo_cliente', rotulo: 'Novo Cliente', grupo: 'Execução' },
  { chave: 'visao_geral', rotulo: 'Visão Geral', grupo: 'Execução' },
  { chave: 'carteira', rotulo: 'Carteira', grupo: 'Execução' },
  // Chave mantida como 'protocolos' de propósito: é o que está gravado em
  // permissoes_menu no banco (renomear a chave quebraria as liberações já configuradas).
  { chave: 'protocolos', rotulo: 'Transcrição Áudio/Vídeo', grupo: 'Execução' },
  { chave: 'matriz', rotulo: 'Matriz de Conhecimento', grupo: 'Execução' },
  {
    chave: 'matriz_detalhada',
    rotulo: 'Matriz por Menu (SIGER)',
    grupo: 'Execução',
  },
  {
    chave: 'matriz_funcoes',
    rotulo: 'Matriz por Menu - Funções SICLA',
    grupo: 'Execução',
  },
  { chave: 'dicionario', rotulo: 'Dicionário Inteligente', grupo: 'Execução' },
  // Protocolo: moldura do Portal Rech (portalrech.com.br) dentro do Painel. A chave é o
  // singular porque 'protocolos' (plural) já pertence à Transcrição Áudio/Vídeo.
  { chave: 'protocolo', rotulo: 'Protocolo', grupo: 'Execução' },
  // RechEdu: moldura do portal de educação (www.rechedu.com.br), irmã da tela Protocolo —
  // mesmo desenho (iframe + credencial própria do consultor guardada no backend).
  { chave: 'rechedu', rotulo: 'RechEdu', grupo: 'Execução' },
  // Agenda: calendário de compromissos dos técnicos (mesma origem SICLA do BI "Alocação de
  // Agendas"), aberto já filtrado no usuário logado, em visão semanal por padrão.
  { chave: 'agenda', rotulo: 'Agenda', grupo: 'Execução' },
  // RNS: consulta de assuntos nas RNS do SICLA (LISTA_ITEMPED) — o consultor pesquisa um
  // assunto e vê as RNS relacionadas (Pedido + Item), no molde do Dicionário Inteligente.
  { chave: 'rns', rotulo: 'RNS', grupo: 'Execução' },
  // Consultor SIGER: base inteligente de conhecimento do CÓDIGO-FONTE do SIGER (F:\SIGER,
  // fonte SOMENTE LEITURA que o Painel nem acessa — consome a base derivada gerada pelo
  // indexador externo). O consultor pergunta em linguagem natural e vê telas, parâmetros,
  // cadastros, validações e menus com arquivo:linha citados.
  { chave: 'consultor_siger', rotulo: 'Consultor SIGER', grupo: 'Execução' },
  { chave: 'coordenacao', rotulo: 'Coordenação', grupo: 'Gestão' },
  {
    chave: 'centro_operacional',
    rotulo: 'Centro Operacional',
    grupo: 'Gestão',
  },
  { chave: 'atividade', rotulo: 'Atividade', grupo: 'Gestão' },
  // Área BI: uma entrada só no menu lateral, duas abas dentro. As DUAS chaves continuam
  // separadas de propósito — o Administrador libera cada BI independentemente.
  { chave: 'dashboards', rotulo: 'BI · BI Implantação', grupo: 'Gestão' },
  {
    chave: 'bi_implantacao',
    rotulo: 'BI · Implantação Clientes SIGER',
    grupo: 'Gestão',
  },
  { chave: 'permissoes', rotulo: 'Permissões', grupo: 'Gestão', fixaAdm: true },
  {
    chave: 'ferramentas',
    rotulo: 'Ferramentas',
    grupo: 'Sistema',
    fixaAdm: true,
  },
  { chave: 'usuarios', rotulo: 'Usuários', grupo: 'Sistema', fixaAdm: true },
  {
    chave: 'checklist',
    rotulo: 'Cad. Checklist',
    grupo: 'Sistema',
    fixaAdm: true,
  },
  {
    chave: 'indice_topicos',
    rotulo: 'Índice de Tópicos',
    grupo: 'Sistema',
    fixaAdm: true,
  },
  {
    chave: 'modelos_docs',
    rotulo: 'Modelos de Docs',
    grupo: 'Sistema',
    fixaAdm: true,
  },
  // `consulta_bd` DEIXOU de ser uma tela deste Painel em 2026-08-26 — Consultas BD mudou
  // para o Portal API. A CHAVE fica, e continua valendo, porque o que ela gateia não é a
  // tela: é quem, entrando por JWT, pode CHAMAR uma consulta publicada pela tela (ver
  // `MENU_CONSULTA_DE_TELA` em dados/catalogo/catalogo.service.ts). Renomear a chave
  // quebraria as liberações já gravadas em `permissoes_menu`, então só o rótulo mudou,
  // para dizer o que ela de fato controla.
  {
    chave: 'consulta_bd',
    rotulo: 'Consultas publicadas pela tela (API de Dados)',
    grupo: 'Sistema',
    fixaAdm: true,
  },
  // Tela do lado CONSUMIDOR: onde se cola o token gerado no Portal API. Entrou no Painel em
  // 2026-08-26, no lugar das telas de administração da API que saíram daqui.
  {
    chave: 'tokens_api',
    rotulo: 'Tokens da API de Dados',
    grupo: 'Sistema',
    fixaAdm: true,
  },
  {
    chave: 'assistente_legado',
    rotulo: 'Assistente Legado',
    grupo: 'Sistema',
    fixaAdm: true,
  },
  // Prontidão do Sistema — visão da Auditoria de Prontidão dos 9 eixos (2026-08-12). fixaAdm:
  // é uma tela de Sistema (só ADM), e o ADM sempre a enxerga pela trava de segurança.
  {
    chave: 'prontidao',
    rotulo: 'Prontidão do Sistema',
    grupo: 'Sistema',
    fixaAdm: true,
  },
];
export const MENU_CHAVES = MENUS.map((m) => m.chave);
export function ehMenuValido(chave: string): boolean {
  return MENU_CHAVES.includes(chave);
}

/** Menus FIXOS do Administrador — o próprio painel de Permissões + as telas de Sistema.
 * Nesses, o ADM tem acesso SEMPRE (trava de segurança: nunca se tranca fora de como
 * consertar permissões). Nos demais menus o ADM é configurável como qualquer papel. */
const MENUS_FIXA_ADM = new Set(
  MENUS.filter((m) => m.fixaAdm).map((m) => m.chave),
);
export function ehFixaAdm(chave: string): boolean {
  return MENUS_FIXA_ADM.has(chave);
}

/** Defaults por papel — espelham as regras que estavam FIXAS no código em 2026-07-28. É o
 * seed inicial da tabela; a partir daí o painel manda. `alteracao` = acesso pleno (regras
 * finas de designação/linha continuam no código); `consulta` = só leitura; ausência = nada. */
export const PADRAO_PERMISSOES: Record<
  string,
  Partial<Record<Perfil, NivelPermissao>>
> = {
  novo_cliente: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Comercial: 'alteracao',
  },
  // Visão Geral (home): todos veem, menos o Comercial — espelha o `!soComercial` antigo.
  visao_geral: {
    ADM: 'consulta',
    Coordenador: 'consulta',
    Administrativo: 'consulta',
    Levantador: 'consulta',
    GCI: 'consulta',
    Consultor: 'consulta',
  },
  carteira: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'alteracao',
    GCI: 'alteracao',
    Consultor: 'alteracao',
    Levantador: 'alteracao',
    Comercial: 'consulta',
  },
  protocolos: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'alteracao',
    GCI: 'alteracao',
    Consultor: 'alteracao',
    Levantador: 'alteracao',
  },
  matriz: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'alteracao',
    GCI: 'alteracao',
    Consultor: 'alteracao',
    Levantador: 'alteracao',
  },
  // Matriz por Menu (SIGER): mesma liberação da Matriz clássica.
  matriz_detalhada: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'alteracao',
    GCI: 'alteracao',
    Consultor: 'alteracao',
    Levantador: 'alteracao',
  },
  // Matriz por Menu - Funções SICLA: mesma liberação das outras duas matrizes.
  matriz_funcoes: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'alteracao',
    GCI: 'alteracao',
    Consultor: 'alteracao',
    Levantador: 'alteracao',
  },
  dicionario: { ADM: 'alteracao' },
  // Protocolo (Portal Rech): mesma liberação da Transcrição Áudio/Vídeo — todo o time
  // interno; o Comercial fica de fora por padrão (ajustável em Gestão → Permissões).
  protocolo: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'alteracao',
    GCI: 'alteracao',
    Consultor: 'alteracao',
    Levantador: 'alteracao',
  },
  // RechEdu: mesma liberação da tela Protocolo — todo o time interno; o Comercial fica de
  // fora por padrão (ajustável em Gestão → Permissões).
  rechedu: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'alteracao',
    GCI: 'alteracao',
    Consultor: 'alteracao',
    Levantador: 'alteracao',
  },
  // Agenda: consulta de compromissos — todo o time interno, como a Transcrição e o
  // Protocolo; o Comercial fica de fora por padrão (ajustável em Gestão → Permissões).
  // `consulta` basta: a tela só lê o SICLA, não há ação de escrita.
  agenda: {
    ADM: 'alteracao',
    Coordenador: 'consulta',
    Administrativo: 'consulta',
    GCI: 'consulta',
    Consultor: 'consulta',
    Levantador: 'consulta',
  },
  // RNS: consulta de assuntos — só leitura do SICLA, mesma liberação da Agenda; o
  // Comercial fica de fora por padrão (ajustável em Gestão → Permissões).
  rns: {
    ADM: 'alteracao',
    Coordenador: 'consulta',
    Administrativo: 'consulta',
    GCI: 'consulta',
    Consultor: 'consulta',
    Levantador: 'consulta',
  },
  // Consultor SIGER: consulta à base de conhecimento do código-fonte — só leitura (a tela
  // toda é pesquisa; o feedback 👍/👎 conta como uso). O Comercial fica de fora por padrão,
  // ajustável em Gestão → Permissões.
  consultor_siger: {
    ADM: 'alteracao',
    Coordenador: 'consulta',
    Administrativo: 'consulta',
    GCI: 'consulta',
    Consultor: 'consulta',
    Levantador: 'consulta',
  },
  coordenacao: { ADM: 'alteracao', Coordenador: 'alteracao', GCI: 'alteracao' },
  centro_operacional: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    GCI: 'alteracao',
  },
  atividade: { ADM: 'alteracao', Coordenador: 'alteracao', GCI: 'alteracao' },
  dashboards: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'alteracao',
    GCI: 'alteracao',
    Consultor: 'alteracao',
    Levantador: 'alteracao',
    Comercial: 'consulta',
  },
  // BI de Implantação: leitura de dado do SICLA (horas, status, grupo econômico). Mesma
  // liberação dos Dashboards, mas sem o Comercial — a tela expõe saldo de horas por cliente.
  bi_implantacao: {
    ADM: 'alteracao',
    Coordenador: 'alteracao',
    Administrativo: 'consulta',
    GCI: 'alteracao',
    Consultor: 'consulta',
    Levantador: 'consulta',
  },
  permissoes: { ADM: 'alteracao' },
  ferramentas: { ADM: 'alteracao' },
  usuarios: { ADM: 'alteracao' },
  checklist: { ADM: 'alteracao' },
  indice_topicos: { ADM: 'alteracao' },
  modelos_docs: { ADM: 'alteracao' },
  consulta_bd: { ADM: 'alteracao' },
  tokens_api: { ADM: 'alteracao' },
  assistente_legado: { ADM: 'alteracao' },
  prontidao: { ADM: 'alteracao' },
};

export const PAPEIS_PERMISSAO: Perfil[] = [...PERFIS];
