export type SlugDocumentoFiel = 'levantamento' | 'projeto' | 'cronograma' | 'termo';

export const SLUGS_DOCUMENTO_FIEL: { slug: SlugDocumentoFiel; label: string }[] = [
  { slug: 'levantamento', label: 'Mapeamento (Levantamento)' },
  { slug: 'projeto', label: 'Projeto de Implantação' },
  { slug: 'cronograma', label: 'Cronograma' },
  { slug: 'termo', label: 'Termo de Encerramento' },
];

export interface Documento {
  id: number;
  projetoId: number;
  tipo: string;
  arquivo: string;
  caminho: string;
  origem: 'gerado' | 'importado';
  criadoEm: string;
}

export interface EventoProjeto {
  id: number;
  projetoId: number;
  tipo: 'nota' | 'etapa' | 'documento' | 'email' | 'alerta';
  descricao: string;
  autor: string;
  criadoEm: string;
}
