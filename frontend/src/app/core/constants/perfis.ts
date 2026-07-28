import { Perfil } from '../models/auth-user.model';

// Espelha backend/src/common/constants/perfis.ts (que por sua vez espelha webapp/app.py)
// — usado só para MOSTRAR/ESCONDER ações na UI; a aplicação real da regra continua no
// backend (guards), então divergir aqui só afeta UX, nunca segurança.
export const PERFIS_GERA_LEVANTAMENTO: Perfil[] = ['ADM', 'Coordenador', 'Administrativo', 'GCI', 'Levantador'];
export const PERFIS_GERA_CRONOGRAMA: Perfil[] = ['ADM', 'Coordenador', 'Administrativo', 'Consultor'];
export const PERFIS_DESIGNA_CONSULTORES: Perfil[] = ['ADM', 'GCI'];
export const PERFIS_AGENDAMENTO: Perfil[] = ['ADM', 'Administrativo'];

// ===== Liberação por item de menu/tela (definição do usuário em 2026-07-28) =====
// Usados nas rotas (perfilGuard) e no menu (shell). A regra de verdade fica no backend.
export const TODOS_PERFIS: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Levantador',
  'GCI',
  'Consultor',
  'Comercial',
];
/** Novo Cliente (passo 1). */
export const MENU_NOVO_CLIENTE: Perfil[] = ['ADM', 'Coordenador', 'Comercial'];
/** Protocolos: todos, menos o Comercial. */
export const MENU_PROTOCOLOS: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Levantador',
  'GCI',
  'Consultor',
];
/** Dicionário Inteligente: só o Administrador. */
export const MENU_DICIONARIO: Perfil[] = ['ADM'];
/** Gestão (Coordenação, Centro Operacional, Atividade). */
export const MENU_GESTAO: Perfil[] = ['ADM', 'Coordenador', 'GCI'];
/** Sistema (usuários, cadastros, config, legado). */
export const MENU_SISTEMA: Perfil[] = ['ADM'];
// Carteira, Matriz e Dashboards = TODOS_PERFIS.

export function podeGerar(tipo: string, perfil: Perfil | undefined): boolean {
  if (!perfil) return false;
  if (tipo === 'levantamento' || tipo === 'projeto') return PERFIS_GERA_LEVANTAMENTO.includes(perfil);
  return PERFIS_GERA_CRONOGRAMA.includes(perfil);
}
