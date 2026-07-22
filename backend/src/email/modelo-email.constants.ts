// Variáveis dinâmicas disponíveis para uso nos modelos de e-mail — espelha
// webapp/db.py:VARIAVEIS_EMAIL (rótulo exibido no seletor "clique para inserir").
export const VARIAVEIS_EMAIL: Record<string, string> = {
  '{{CLIENTE}}': 'Razão Social do cliente',
  '{{CNPJ}}': 'CNPJ do cliente',
  '{{NUMERO_PROJETO}}': 'Número do projeto',
  '{{NUMERO_PROPOSTA}}': 'Número da proposta',
  '{{GCI}}': 'GCI responsável pelo levantamento',
  '{{CONSULTOR}}': 'Consultor(es) designado(s)',
  '{{CONSULTOR_A}}': 'Primeiro consultor designado',
  '{{CONSULTOR_B}}': 'Segundo consultor designado',
  '{{CONSULTOR_X}}': 'Primeiro consultor (implantação)',
  '{{CONSULTOR_Y}}': 'Segundo consultor (implantação)',
  '{{CONSULTOR_RESPONSAVEL}}': 'Consultor responsável principal',
  '{{DATA_LEVANTAMENTO}}': 'Data do levantamento agendado',
  '{{DATA_INICIO}}': 'Data de início do projeto',
  '{{DATA_USO_OFICIAL}}': 'Data de go-live (uso oficial)',
  '{{DATA_ENCERRAMENTO}}': 'Data de encerramento',
  '{{MODULOS}}': 'Módulos contratados',
  '{{HORAS_COBRADAS}}': 'Horas cobradas',
  '{{HORAS_BONIFICADAS}}': 'Horas bonificadas',
  '{{CONTATO_NOME}}': 'Nome do contato no cliente',
  '{{CONTATO_EMAIL}}': 'E-mail do contato no cliente',
  '{{CONTATO_TEL}}': 'Telefone do contato no cliente',
  '{{RESPONSAVEL}}': 'Responsável administrativo',
  '{{RAMO}}': 'Ramo de atividade',
  '{{NOME_CONTATO}}': 'Nome do contato (alias de {{CONTATO_NOME}})',
  '{{FONE_CONTATO}}': 'Telefone do contato (alias de {{CONTATO_TEL}})',
};

// Variável -> campo do projeto (camelCase — nomes da entidade Projeto). `_consultorA`/
// `_consultorB` são derivados em runtime (split de `consultor` por vírgula), não colunas
// reais — mesmo padrão de webapp/db.py:_VAR_CAMPO.
export const VAR_CAMPO: Record<string, string> = {
  '{{CLIENTE}}': 'cliente',
  '{{CNPJ}}': 'cnpj',
  '{{NUMERO_PROJETO}}': 'numeroProjeto',
  '{{NUMERO_PROPOSTA}}': 'numeroProposta',
  '{{GCI}}': 'gci',
  '{{CONSULTOR}}': 'consultor',
  '{{CONSULTOR_A}}': '_consultorA',
  '{{CONSULTOR_B}}': '_consultorB',
  '{{CONSULTOR_X}}': '_consultorA',
  '{{CONSULTOR_Y}}': '_consultorB',
  '{{CONSULTOR_RESPONSAVEL}}': 'consultor',
  '{{DATA_LEVANTAMENTO}}': 'dataLevantamento',
  '{{DATA_INICIO}}': 'dataInicio',
  '{{DATA_USO_OFICIAL}}': 'dataUsoOficial',
  '{{DATA_ENCERRAMENTO}}': 'dataEncerramento',
  '{{MODULOS}}': 'modulos',
  '{{HORAS_COBRADAS}}': 'horasCobradas',
  '{{HORAS_BONIFICADAS}}': 'horasBonificadas',
  '{{CONTATO_NOME}}': 'contatoNome',
  '{{CONTATO_EMAIL}}': 'contatoEmail',
  '{{CONTATO_TEL}}': 'contatoTel',
  '{{RESPONSAVEL}}': 'responsavel',
  '{{RAMO}}': 'ramo',
  '{{NOME_CONTATO}}': 'contatoNome',
  '{{FONE_CONTATO}}': 'contatoTel',
};

export interface ModeloEmailPadrao {
  slug: string;
  nome: string;
  assunto: string;
  corpo: string;
  etapa: string;
}

// Migrados 1:1 de webapp/db.py:_MODELOS_PADRAO.
export const MODELOS_EMAIL_PADRAO: ModeloEmailPadrao[] = [
  {
    slug: 'encaminhamento',
    nome: 'Encaminhamento / Abertura da implantação',
    assunto: 'Implantação do SIGER® — {{CLIENTE}}',
    corpo:
      'Olá,\n\nDamos início à implantação do ERP SIGER® na {{CLIENTE}} ' +
      '(projeto nº {{NUMERO_PROJETO}}). O consultor responsável será ' +
      '{{CONSULTOR}}, que entrará em contato para alinhar o cronograma e ' +
      'os próximos passos.\n\nFicamos à disposição.\n\n' +
      'Atenciosamente,\nEquipe de Implantação — Rech Sistemas de Gestão',
    etapa: 'Agendamento',
  },
  {
    slug: 'cronograma',
    nome: 'Compartilhamento do cronograma',
    assunto: 'Cronograma de Implantação — {{CLIENTE}}',
    corpo:
      'Olá,\n\nSegue o cronograma de implantação do SIGER® para a {{CLIENTE}} ' +
      '(projeto nº {{NUMERO_PROJETO}}), com as agendas e os macro tópicos de ' +
      'cada visita/treinamento. Por favor, confirme as datas ou retorne com ' +
      'ajustes.\n\nAtenciosamente,\nEquipe de Implantação — Rech Sistemas de Gestão',
    etapa: 'Cronograma e Check-list',
  },
  {
    slug: 'encerramento',
    nome: 'Encerramento da implantação (ao cliente)',
    assunto: 'Encerramento da implantação do SIGER® — {{CLIENTE}}',
    corpo:
      'Prezado(a) {{CONTATO_NOME}},\n\n' +
      'Comunicamos o encerramento da implantação do ERP SIGER® junto à {{CLIENTE}}, ' +
      'conforme o projeto nº {{NUMERO_PROJETO}}.\n\n' +
      'A partir de agora, o canal principal de atendimento passa a ser o Suporte da Rech:\n' +
      '- Telefone (51) 3582.4001 (prioritário)\n' +
      '- E-mail suporte@rech.com.br\n' +
      '- Manual do sistema: tecla F1 em qualquer módulo.\n\n' +
      'Encaminhamos em anexo o Termo de Encerramento para formalização. ' +
      'Agradecemos a parceria durante o projeto.\n\n' +
      'Atenciosamente,\n{{CONSULTOR_RESPONSAVEL}} — Implantação Rech',
    etapa: 'Encerramento',
  },
  {
    slug: 'encerramento-coordenacao',
    nome: 'Encerramento da implantação (à Coordenação)',
    assunto:
      'Encerramento de Implantação — {{CLIENTE}} — RNS(I) {{NUMERO_PROJETO}}',
    corpo:
      'Olá,\n\nInformo o encerramento da implantação do cliente {{CLIENTE}} ' +
      '(projeto nº {{NUMERO_PROJETO}}).\n\n' +
      'Segue o checklist formalizado:\n' +
      'a. Módulos não implantados: \n' +
      'b. RNS em aberto: \n' +
      'c. RNS não entregue: \n' +
      'd. Pendências não encaminhadas: \n' +
      'e. Saldo de horas: \n' +
      'f. Responsável pela atualização: \n' +
      'g. Ajuste de deslocamento: \n' +
      'h. Negociações em aberto: \n' +
      'i. Ressalvas para ações de publicidade: \n\n' +
      'Atenciosamente,\n{{CONSULTOR_RESPONSAVEL}}',
    etapa: 'Encerramento',
  },
  {
    slug: 'encaminhamento-levantamento',
    nome: 'Encaminhamento — Levantamento / Demonstração',
    assunto: 'Encaminhamento — Levantamento / Demonstração — {{CLIENTE}}',
    corpo:
      'Bom dia!\n\nConsultor(es) {{CONSULTOR_A}} e {{CONSULTOR_B}}\n\n' +
      'Esse processo será(ão) executado(s) por você(s):\n' +
      '- [ ] Levantamento\n' +
      '- [ ] Demonstração\n\n' +
      'Elaborado o escopo dos documentos solicitados, segue abaixo o link de acesso.\n\n' +
      '- Levantamento de processos: (inserir link)\n' +
      '- Planilha de horas: (inserir link)\n\n' +
      'Atenciosamente,\nAdm',
    etapa: 'Levantamento',
  },
  {
    slug: 'encaminhamento-implantacao',
    nome: 'Encaminhamento de Implantação (ao consultor)',
    assunto: 'Encaminhamento de Implantação — {{CLIENTE}}',
    corpo:
      'Bom dia!\n\nConsultor(es) {{CONSULTOR_X}} e {{CONSULTOR_Y}}!\n\n' +
      'Essa implantação ficará com você.\n\n' +
      'Por gentileza, proceder com nossa documentação padrão e aguardar a instalação ' +
      'para marcar a visita inicial com o cliente.\n\n' +
      'Lembramos que o prazo para elaboração do Projeto, Cronograma e comunicação ao ADM ' +
      'é de no máximo 5 dias úteis após o envio deste e-mail.\n\n' +
      'Contato no cliente: {{CONTATO_NOME}} — Fone: {{CONTATO_TEL}}\n\n' +
      'Atenciosamente,\nAdm',
    etapa: 'Designação',
  },
  {
    slug: 'boas-vindas',
    nome: 'Boas-vindas ao cliente',
    assunto: 'Bem-vindo(a) à implantação do SIGER® — {{CLIENTE}}',
    corpo:
      'Olá, {{CONTATO_NOME}}!\n\n' +
      'Seja muito bem-vindo(a) ao processo de implantação do SIGER®. ' +
      'A partir de agora seremos seu time de implantação na Rech.\n\n' +
      'Seus consultores: {{CONSULTOR_X}} e {{CONSULTOR_Y}}\n\n' +
      'Próximos passos:\n' +
      '1. Conclusão da instalação do SIGER® no seu ambiente.\n' +
      '2. Visita/reunião inicial de alinhamento (agendaremos em seguida).\n' +
      '3. Compartilharemos o cronograma com as datas e temas de cada etapa.\n\n' +
      'Qualquer dúvida nesta fase, fale diretamente com seus consultores.\n\n' +
      'Atenciosamente,\n{{CONSULTOR_RESPONSAVEL}} — Implantação Rech',
    etapa: 'Designação',
  },
];
