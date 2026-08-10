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
  'Comercial',
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
  Comercial: 'Comercial',
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

/** As 6 macro-etapas, NA ORDEM DO PROCESSO — a ordem do array é usada como sequência
 * (stepper, funil, % de progresso, coluna do Kanban e a "próxima etapa" do botão Avançar).
 *
 * `Designação` vem ANTES de `Projeto` porque é assim que os 21 passos correm: 8–9 são a
 * Designação (indicar o GCI e os técnicos, incluir as RNS) e 10–12 são o Projeto (criar,
 * conferir, sinalizar assinado). Até 2026-08-05 o array tinha as duas invertidas: como
 * `sincronizarEtapa` deriva a macro-etapa do primeiro passo pendente, o projeto andava para
 * "Designação" (índice 3) e depois para "Projeto" (índice 2) — ou seja, REGREDIA em toda
 * tela que lê a ordem daqui.
 *
 * ⚠️ Mexer nesta ordem exige revisar junto `GATES`, `ACAO_ENTRADA` e `CAMPOS_OBRIGATORIOS`
 * (metricas.constants.ts): os três são indexados por NOME, então não acompanham sozinhos —
 * eles descrevem o que já precisa existir para o projeto estar naquela etapa, e isso muda
 * quando a etapa muda de lugar na fila. O valor gravado em `projetos.etapa` é o NOME, então
 * reordenar não exige migração de dados. */
export const ETAPAS = [
  'Agendamento',
  'Levantamento',
  'Designação',
  'Projeto',
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

/** Natureza da demanda aberta pelo Comercial no passo 1 — "Geração da demanda de
 * levantamento / demonstração" (docs/processo-implantacao.md §2.1.1). São os dois motivos
 * pelos quais o Comercial aciona a Implantação na pré-implantação: mapear os processos do
 * cliente (Levantamento) ou apoiar uma demonstração do SIGER® (Demonstração). Escolha
 * OBRIGATÓRIA no cadastro do cliente. */
export const TIPOS_DEMANDA = ['Levantamento', 'Demonstração'] as const;
export type TipoDemanda = (typeof TIPOS_DEMANDA)[number];

// pode_ver("gestao") no Flask — mantido para telas que ainda incluem o Administrativo.
export const PERFIS_GESTAO: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'GCI',
];
// pode_ver("sistema") no Flask
export const PERFIS_SISTEMA: Perfil[] = ['ADM'];

// ===== Liberação por item de menu/tela (definição do usuário em 2026-07-28) =====
// Espelha frontend/src/app/core/constants/perfis.ts (MENU_*). Aqui é a regra de verdade,
// aplicada como @Roles nos controllers.
/** Protocolos: todo o time de implantação, menos o Comercial. */
export const PERFIS_MENU_PROTOCOLOS: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Levantador',
  'GCI',
  'Consultor',
];
/** Dicionário Inteligente: só o Administrador. */
export const PERFIS_MENU_DICIONARIO: Perfil[] = ['ADM'];
/** Matriz de Conhecimento: todo o time, menos o Comercial (que não entra nessa tela). */
export const PERFIS_MENU_MATRIZ: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Levantador',
  'GCI',
  'Consultor',
];
/** Gestão (Coordenação, Centro Operacional, Atividade) — SEM o Administrativo. Não confundir
 * com PERFIS_GESTAO (que ainda inclui o Administrativo, usado por outras telas). */
export const PERFIS_MENU_GESTAO: Perfil[] = ['ADM', 'Coordenador', 'GCI'];
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
// Hierarquia de visibilidade de CLIENTES na Carteira (definição do usuário em 2026-07-28):
// ADM/Coordenador/Administrativo/Comercial veem TODOS; GCI/Consultor/Levantador só os
// projetos em que foram designados. Igual a PERFIS_VEEM_TODOS_PROJETOS + Comercial — mantida
// separada porque o Comercial vê a Carteira mas NÃO entra em outras telas (ex.: Matriz).
export const PERFIS_CARTEIRA_VE_TODOS: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Comercial',
];
// pode_gerar("cronograma") no Flask — todos os perfis exceto GCI.
export const PERFIS_GERA_CRONOGRAMA: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Consultor',
];
// pode_gerar("levantamento") — quem preenche/gera o Levantamento. Inclui o Levantador, que é
// o responsável pelo passo 3 "Realizar o Levantamento" (2026-07-28).
export const PERFIS_GERA_LEVANTAMENTO: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'GCI',
  'Levantador',
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
