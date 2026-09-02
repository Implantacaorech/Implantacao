/** Controle de acessos — quem está no Painel agora e em que tela.
 * Espelha `GET /presenca` (backend `presenca/`). */

export interface SessaoOnline {
  sessao: string;
  rota: string;
  titulo: string;
  visivel: boolean;
  ip: string;
  navegador: string;
  desdeSegundos: number;
  inativoSegundos: number;
}

export interface UsuarioOnline {
  usuarioId: number;
  nome: string;
  perfil: string;
  telaAtual: string;
  rotaAtual: string;
  inativoSegundos: number;
  /** Aba em segundo plano, ou sem batida há muito tempo. */
  ocioso: boolean;
  sessoes: SessaoOnline[];
}

export interface PanoramaPresenca {
  agora: string;
  janelaSegundos: number;
  intervaloPingSegundos: number;
  totalUsuarios: number;
  totalSessoes: number;
  usuarios: UsuarioOnline[];
}
