import { Perfil } from './auth-user.model';

export const PERFIS: Perfil[] = [
  'ADM',
  'Coordenador',
  'Administrativo',
  'Levantador',
  'GCI',
  'Consultor',
  'Comercial',
];

/** Rótulo de cada papel na tela — 'ADM' é como o valor é gravado desde o Flask. */
export const ROTULO_PERFIL: Record<string, string> = {
  ADM: 'Administrador',
  Coordenador: 'Coordenador',
  Administrativo: 'Administrativo',
  Levantador: 'Levantador',
  GCI: 'GCI',
  Consultor: 'Consultor',
  Comercial: 'Comercial',
};

export interface Usuario {
  id: number;
  login: string;
  nome: string;
  email: string;
  /** Papel principal — o que aparece quando só cabe um rótulo. */
  perfil: Perfil;
  /** Todos os papéis, separados por vírgula. Uma pessoa acumula cargos. */
  perfis?: string;
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
  perfis?: Perfil[];
  codigoSicla: string;
  ativo?: boolean;
}

export type AtualizarUsuarioPayload = Partial<CriarUsuarioPayload>;
