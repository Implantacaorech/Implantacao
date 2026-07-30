import { Perfil } from '../models/auth-user.model';

/** O mínimo que estas funções precisam do usuário logado (aceita o `AuthUser` inteiro). */
export interface UsuarioComPapeis {
  perfil?: Perfil;
  perfis?: Perfil[];
}

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
/** Matriz de Conhecimento: todo o time, menos o Comercial. */
export const MENU_MATRIZ: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Levantador',
  'GCI',
  'Consultor',
];
/** Sistema (usuários, cadastros, config, legado). */
export const MENU_SISTEMA: Perfil[] = ['ADM'];
// Carteira e Dashboards = TODOS_PERFIS.

/** Papéis efetivos do usuário — `perfis` (todos) com fallback no `perfil` principal (token
 * antigo, emitido antes dos papéis múltiplos). */
export function papeisDe(usuario: UsuarioComPapeis | undefined | null): Perfil[] {
  if (!usuario) return [];
  return usuario.perfis?.length ? usuario.perfis : usuario.perfil ? [usuario.perfil] : [];
}

/** Espelha `temPapel()` do backend: o usuário TEM o papel se ele está entre os dele. Usar
 * sempre isto no lugar de comparar com o `perfil` principal — a pessoa acumula cargos
 * (é GCI e Levantador, por exemplo), e comparar com um só escondia ação legítima. */
export function temPapel(
  usuario: UsuarioComPapeis | undefined | null,
  ...papeis: Perfil[]
): boolean {
  const meus = papeisDe(usuario);
  return papeis.some((p) => meus.includes(p));
}

/** "É SÓ Comercial" — quem acumula Comercial + outro papel segue o fluxo interno. */
export function soComercial(usuario: UsuarioComPapeis | undefined | null): boolean {
  const meus = papeisDe(usuario);
  return meus.length > 0 && meus.every((p) => p === 'Comercial');
}

export function podeGerar(
  tipo: string,
  usuario: UsuarioComPapeis | undefined | null,
): boolean {
  if (tipo === 'levantamento' || tipo === 'projeto') {
    return temPapel(usuario, ...PERFIS_GERA_LEVANTAMENTO);
  }
  return temPapel(usuario, ...PERFIS_GERA_CRONOGRAMA);
}
