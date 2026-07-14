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
// Gate de webapp/routes_designacao.py:projeto_definir_gci/projeto_agendar (Etapas 2 e 5
// do processo real — ver memória de projeto "processo-etapas-responsaveis-emails"):
// SÓ o Administrativo define o GCI e agenda o Levantamento — Coordenador fica de fora de
// propósito aqui, apesar de estar em PERFIS_DESIGNA (confirmado com o usuário, não é bug).
export const PERFIS_AGENDAMENTO: Perfil[] = ['ADM', 'Administrativo'];
// Gate de webapp/routes_designacao.py:projeto_consultores (Etapa 6 do processo real): só
// o GCI designa os consultores da implantação — Coordenador/Administrativo ficam de fora
// de propósito aqui (confirmado com o usuário).
export const PERFIS_DESIGNA_CONSULTORES: Perfil[] = ['ADM', 'GCI'];
