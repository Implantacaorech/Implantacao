import { Perfil } from './auth-user.model';

export const PERFIS: Perfil[] = ['ADM', 'Coordenador', 'Administrativo', 'GCI', 'Consultor'];

export interface Usuario {
  id: number;
  login: string;
  nome: string;
  email: string;
  perfil: Perfil;
  codigoSicla: string;
  ativo: boolean;
  criadoEm: string;
}

export interface CriarUsuarioPayload {
  nome?: string;
  email: string;
  login?: string;
  senha: string;
  perfil?: Perfil;
  codigoSicla: string;
  ativo?: boolean;
}

export type AtualizarUsuarioPayload = Partial<CriarUsuarioPayload>;
