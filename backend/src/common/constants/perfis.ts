// Espelha PERFIS/ETAPAS/SITUACOES de webapp/db.py — mesma nomenclatura usada nos dados
// existentes para permitir importar o Postgres de produção sem re-mapear valores.
/** Papéis do processo. Um usuário pode acumular VÁRIOS (revisão de 2026-07-22): a mesma
 * pessoa costuma ser GCI e Levantador, por exemplo. `ADM` é o "Administrador" — o único
 * que faz tudo, em qualquer projeto. */
export const PERFIS = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Levantador',
  'GCI',
  'Consultor',
] as const;
export type Perfil = (typeof PERFIS)[number];

/** Rótulo de cada papel na tela — 'ADM' é gravado assim no banco desde o Flask. */
export const ROTULO_PERFIL: Record<Perfil, string> = {
  ADM: 'Administrador',
  Coordenador: 'Coordenador',
  Administrativo: 'Administrativo',
  Levantador: 'Levantador',
  GCI: 'GCI',
  Consultor: 'Consultor',
};

/** Um usuário TEM o papel se ele está na lista de papéis dele. Usar sempre isto no lugar
 * de comparar com um único `perfil` — a pessoa acumula cargos. */
export function temPapel(
  usuario: { perfil: Perfil; perfis?: Perfil[] } | undefined | null,
  ...papeis: Perfil[]
): boolean {
  if (!usuario) return false;
  const meus = usuario.perfis?.length ? usuario.perfis : [usuario.perfil];
  return papeis.some((p) => meus.includes(p));
}

export const ETAPAS = [
  'Agendamento',
  'Levantamento',
  'Projeto',
  'Designação',
  'Cronograma e Check-list',
  'Encerramento',
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const SITUACOES = [
  'Em andamento',
  'Em risco',
  'Pausado',
  'Concluído',
] as const;
export type Situacao = (typeof SITUACOES)[number];

// pode_ver("gestao") no Flask
export const PERFIS_GESTAO: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'GCI',
];
// pode_ver("sistema") no Flask
export const PERFIS_SISTEMA: Perfil[] = ['ADM'];
// pode_designar() no Flask
export const PERFIS_DESIGNA: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
];
// Grupo que "vê tudo" em _so_meus() — não confundir com PERFIS_GESTAO (aquele controla
// visibilidade de MENU/tela e inclui GCI; este controla FILTRO DE LINHAS na lista de
// projetos, onde GCI só vê os projetos em que é o próprio GCI).
export const PERFIS_VEEM_TODOS_PROJETOS: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
];
// pode_gerar("cronograma") no Flask — todos os perfis exceto GCI.
export const PERFIS_GERA_CRONOGRAMA: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Consultor',
];
// pode_gerar("levantamento") no Flask — todos os perfis exceto Consultor.
export const PERFIS_GERA_LEVANTAMENTO: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'GCI',
];
// Agendar o Levantamento é do Administrativo — passo 2 do processo (`PASSOS` em
// passos/passos.constants.ts). Coordenador fica de fora de propósito, apesar de estar em
// PERFIS_DESIGNA.
export const PERFIS_AGENDAMENTO: Perfil[] = ['ADM', 'Administrativo'];

// REVISÃO DO PROCESSO EM 2026-07-22 — mudança deliberada, confirmada com o usuário.
//
// Antes: o Administrativo definia o GCI e o GCI designava os consultores.
// Agora: o passo 6 é do COORDENADOR, que indica o GCI **e** os técnicos de uma vez.
//
// As duas constantes abaixo passam a valer para a mesma pessoa por isso — quem indica o
// GCI é quem indica os consultores. Mantidas separadas porque as rotas são distintas e
// podem voltar a divergir.
export const PERFIS_DEFINE_GCI: Perfil[] = ['ADM', 'Coordenador'];
export const PERFIS_DESIGNA_CONSULTORES: Perfil[] = ['ADM', 'Coordenador'];
