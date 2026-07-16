import { Perfil } from '../models/auth-user.model';

// Espelha backend/src/common/constants/perfis.ts (que por sua vez espelha webapp/app.py)
// — usado só para MOSTRAR/ESCONDER ações na UI; a aplicação real da regra continua no
// backend (guards), então divergir aqui só afeta UX, nunca segurança.
export const PERFIS_GERA_LEVANTAMENTO: Perfil[] = ['ADM', 'Coordenador', 'Administrativo', 'GCI'];
export const PERFIS_GERA_CRONOGRAMA: Perfil[] = ['ADM', 'Coordenador', 'Administrativo', 'Consultor'];
export const PERFIS_DESIGNA_CONSULTORES: Perfil[] = ['ADM', 'GCI'];
export const PERFIS_AGENDAMENTO: Perfil[] = ['ADM', 'Administrativo'];

export function podeGerar(tipo: string, perfil: Perfil | undefined): boolean {
  if (!perfil) return false;
  if (tipo === 'levantamento' || tipo === 'projeto') return PERFIS_GERA_LEVANTAMENTO.includes(perfil);
  return PERFIS_GERA_CRONOGRAMA.includes(perfil);
}
