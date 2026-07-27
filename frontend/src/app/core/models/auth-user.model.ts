/** Papéis do processo. 'ADM' é o Administrador. Uma pessoa pode acumular vários. */
export type Perfil =
  | 'ADM'
  | 'Coordenador'
  | 'Administrativo'
  | 'Levantador'
  | 'GCI'
  | 'Consultor'
  | 'Comercial';

export interface AuthUser {
  sub: number;
  login: string;
  nome: string;
  /** Papel principal — para exibição. */
  perfil: Perfil;
  /** TODOS os papéis do usuário; é por aqui que a tela decide o que mostrar. */
  perfis?: Perfil[];
  codigoSicla: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  usuario: AuthUser;
}
