/** Os 18 passos operacionais do processo de implantação (revisão de 2026-07-22).
 * Espelha `DefinicaoPasso`/`PassoView` do backend (`src/passos/passos.constants.ts`). */

export type ResponsavelPasso =
  | 'Automatico'
  | 'Administrativo'
  | 'Levantador'
  | 'Coordenador'
  | 'GCI'
  | 'Consultor';

export interface Passo {
  numero: number;
  titulo: string;
  etapa: string;
  responsavel: ResponsavelPasso;
  /** Passos que precisam estar concluídos antes deste. */
  depende: number[];
  /** Concluído é definitivo — não pode ser desmarcado. */
  irreversivel: boolean;
  email?: string;
  observacao?: string;

  concluido: boolean;
  concluidoEm: string | null;
  concluidoPor: string;
  conferido: boolean;
  bloqueadoPor: number[];
  /** Pode ser concluído agora por quem está vendo a tela. */
  liberado: boolean;
  /** Por que não está liberado, em linguagem de negócio. */
  motivos: string[];
}

export type PapelProjeto = 'levantador' | 'consultor';

export interface PessoaProjeto {
  id: number;
  projetoId: number;
  pessoa: string;
  papel: PapelProjeto;
}

export interface PessoasProjeto {
  levantadores: PessoaProjeto[];
  consultores: PessoaProjeto[];
}

export type TipoRns = 'RNI' | 'COB' | 'Conversão';

export interface Rns {
  id: number;
  projetoId: number;
  tipo: TipoRns;
  numero: string;
  descricao: string;
  situacao: string;
}

export const TIPOS_RNS: TipoRns[] = ['RNI', 'COB', 'Conversão'];

/** Passos cujo registro é o e-mail ENCAMINHADO pelo Outlook — espelha
 * `PASSOS_COM_ANEXO_DE_EMAIL` do backend. */
export const PASSOS_COM_ANEXO_DE_EMAIL = [4, 5];

/** Em que passo cada projeto está — alimenta o quadro por fase (Kanban). */
export interface PassoAtualDoProjeto {
  projetoId: number;
  /** Primeiro passo PENDENTE; null quando o processo inteiro foi concluído. */
  passo: number | null;
  titulo: string;
  responsavel: ResponsavelPasso | null;
  etapa: string;
  concluidos: number;
  total: number;
}
