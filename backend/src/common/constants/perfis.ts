// Espelha PERFIS/ETAPAS/SITUACOES de webapp/db.py — mesma nomenclatura usada nos dados
// existentes para permitir importar o Postgres de produção sem re-mapear valores.
export const PERFIS = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'GCI',
  'Consultor',
] as const;
export type Perfil = (typeof PERFIS)[number];

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
