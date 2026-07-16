export type SlugDocumentoFiel = 'levantamento' | 'projeto' | 'cronograma' | 'termo';

export const SLUGS_DOCUMENTO_FIEL: { slug: SlugDocumentoFiel; label: string }[] = [
  { slug: 'levantamento', label: 'Mapeamento (Levantamento)' },
  { slug: 'projeto', label: 'Projeto de Implantação' },
  { slug: 'cronograma', label: 'Cronograma' },
  { slug: 'termo', label: 'Termo de Encerramento' },
];

// Espelha webapp/routes_geracao.py:DOC_LABELS — usado no seletor de tipo do anexo manual
// (projeto_ficha.html, formulário "Anexar documento manualmente").
export const DOC_TIPOS: { tipo: string; label: string }[] = [
  { tipo: 'levantamento', label: 'Mapeamento (Levantamento)' },
  { tipo: 'projeto', label: 'Projeto de Implantação' },
  { tipo: 'cronograma', label: 'Cronograma' },
  { tipo: 'termo', label: 'Termo de Encerramento' },
  { tipo: 'checklist', label: 'Check List' },
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
