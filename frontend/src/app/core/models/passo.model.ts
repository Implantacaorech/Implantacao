/** Os 21 passos operacionais do processo de implantação (revisão de 2026-07-30).
 * Espelha `DefinicaoPasso`/`PassoView` do backend (`src/passos/passos.constants.ts`). */

export type ResponsavelPasso =
  | 'Comercial'
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
  /** Assinatura marcada (passos 7 e 12) e a data informada. */
  marcado: boolean;
  dataMarcada: string;
  /** Texto que a PESSOA escreveu ao concluir — a descrição da negociação, no passo 5.
   * Distinto de `observacao`, que é a explicação estática do que o passo é. */
  observacaoRegistrada: string;
  /** Rótulo da marcação que o passo cobra ('Contrato assinado'…), ou vazio. */
  rotuloMarcacao: string;
  /** A pessoa redige o e-mail na tela antes de o Painel enviar. */
  redigeEmail: boolean;
  /** A pessoa pode anexar arquivos ao e-mail que vai sair (passo 16). */
  aceitaAnexoLivre: boolean;
  bloqueadoPor: number[];
  /** Pode ser concluído agora por quem está vendo a tela. */
  liberado: boolean;
  /** Por que não está liberado, em linguagem de negócio. */
  motivos: string[];
  /** Pode ABRIR a tela de trabalho do passo (Levantamento, Projeto, Agenda, Check-list) —
   * permissão da TELA, diferente da de concluir o passo. `false` nos passos que se
   * resolvem na própria ficha. */
  podeAbrir: boolean;
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
export const PASSOS_COM_ANEXO_DE_EMAIL = [4, 6];

/** E-mail de um passo, já montado pelo backend, para a pessoa revisar antes de enviar. */
export interface EmailDoPasso {
  para: string[];
  assunto: string;
  corpo: string;
  /** Nome do arquivo que vai em anexo, quando houver. */
  anexo: string;
}

export type StatusEmailPasso = 'enviado' | 'falhou' | 'sem_destinatario';

/** E-mail já gerado num passo — o que a consulta relê. */
export interface EmailRegistrado {
  id: number;
  projetoId: number;
  passo: number;
  para: string;
  assunto: string;
  corpo: string;
  anexo: string;
  status: StatusEmailPasso;
  erro: string;
  autor: string;
  criadoEm: string;
}

/** Destinatários de um passo, como a tela de Ferramentas os edita. */
export interface DestinatarioPassoView {
  passo: number;
  titulo: string;
  responsavel: string;
  grupos: string[];
  extras: string[];
  ativo: boolean;
  /** `false` = nunca configurado; está valendo o padrão do código. */
  configurado: boolean;
}

export interface DestinatariosPassoResposta {
  passos: DestinatarioPassoView[];
  grupos: { valor: string; rotulo: string }[];
}

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

/** Status de uma fase na Grade da carteira. */
export type StatusFase = 'realizado' | 'andamento' | 'nao';

/** Grade Cliente × fases: colunas (`passos`) + uma linha por projeto com o status de cada
 * passo (mapa número→status). */
export interface GradeView {
  passos: { numero: number; titulo: string; etapa: string }[];
  linhas: {
    projetoId: number;
    cliente: string;
    status: Record<number, StatusFase>;
  }[];
}
