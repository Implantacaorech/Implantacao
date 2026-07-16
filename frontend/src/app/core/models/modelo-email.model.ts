export interface ModeloEmail {
  id: number;
  slug: string;
  nome: string;
  assunto: string;
  corpo: string;
  etapa: string;
  ativo: boolean;
  padrao: boolean;
}

export interface SalvarModeloEmailPayload {
  nome: string;
  assunto: string;
  corpo: string;
  etapa?: string;
  ativo?: boolean;
}

// Espelha backend/src/email/modelo-email.constants.ts:VARIAVEIS_EMAIL (não exposto via
// API — painel "Variáveis disponíveis" do formulário de modelo).
export const VARIAVEIS_EMAIL: { variavel: string; descricao: string }[] = [
  { variavel: '{{CLIENTE}}', descricao: 'Razão Social do cliente' },
  { variavel: '{{CNPJ}}', descricao: 'CNPJ do cliente' },
  { variavel: '{{NUMERO_PROJETO}}', descricao: 'Número do projeto' },
  { variavel: '{{NUMERO_PROPOSTA}}', descricao: 'Número da proposta' },
  { variavel: '{{GCI}}', descricao: 'GCI responsável pelo levantamento' },
  { variavel: '{{CONSULTOR}}', descricao: 'Consultor(es) designado(s)' },
  { variavel: '{{CONSULTOR_A}}', descricao: 'Primeiro consultor designado' },
  { variavel: '{{CONSULTOR_B}}', descricao: 'Segundo consultor designado' },
  { variavel: '{{CONSULTOR_X}}', descricao: 'Primeiro consultor (implantação)' },
  { variavel: '{{CONSULTOR_Y}}', descricao: 'Segundo consultor (implantação)' },
  { variavel: '{{CONSULTOR_RESPONSAVEL}}', descricao: 'Consultor responsável principal' },
  { variavel: '{{DATA_LEVANTAMENTO}}', descricao: 'Data do levantamento agendado' },
  { variavel: '{{DATA_INICIO}}', descricao: 'Data de início do projeto' },
  { variavel: '{{DATA_USO_OFICIAL}}', descricao: 'Data de go-live (uso oficial)' },
  { variavel: '{{DATA_ENCERRAMENTO}}', descricao: 'Data de encerramento' },
  { variavel: '{{MODULOS}}', descricao: 'Módulos contratados' },
  { variavel: '{{HORAS_COBRADAS}}', descricao: 'Horas cobradas' },
  { variavel: '{{HORAS_BONIFICADAS}}', descricao: 'Horas bonificadas' },
  { variavel: '{{CONTATO_NOME}}', descricao: 'Nome do contato no cliente' },
  { variavel: '{{CONTATO_EMAIL}}', descricao: 'E-mail do contato no cliente' },
  { variavel: '{{CONTATO_TEL}}', descricao: 'Telefone do contato no cliente' },
  { variavel: '{{RESPONSAVEL}}', descricao: 'Responsável administrativo' },
  { variavel: '{{RAMO}}', descricao: 'Ramo de atividade' },
  { variavel: '{{NOME_CONTATO}}', descricao: 'Nome do contato (alias de {{CONTATO_NOME}})' },
  { variavel: '{{FONE_CONTATO}}', descricao: 'Telefone do contato (alias de {{CONTATO_TEL}})' },
];
