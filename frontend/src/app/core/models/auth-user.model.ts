export type Perfil = 'ADM' | 'Coordenador' | 'Administrativo' | 'GCI' | 'Consultor';

export interface AuthUser {
  sub: number;
  login: string;
  nome: string;
  perfil: Perfil;
  codigoSicla: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  usuario: AuthUser;
}
