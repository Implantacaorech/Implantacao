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
  {
    chave: 'consulta_bd',
    rotulo: 'Consulta BD',
    grupo: 'Sistema',
    fixaAdm: true,
  },
  {
    chave: 'assistente_legado',
    rotulo: 'Assistente Legado',
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
  assistente_legado: { ADM: 'alteracao' },
};

export const PAPEIS_PERMISSAO: Perfil[] = [...PERFIS];
