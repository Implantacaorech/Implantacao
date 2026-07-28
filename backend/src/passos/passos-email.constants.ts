/** Quem recebe o e-mail de cada passo e o que ele diz.
 *
 * O mapa dos passos (`passos.constants.ts`) descreve o e-mail em linguagem de negócio; aqui
 * está o contrato executável: destinatários e texto. Separado de propósito — o processo
 * (quem faz o quê) muda por decisão de negócio; o texto do e-mail muda por redação. */

/** Grupos de destinatário que o sistema sabe resolver. */
export type DestinatarioPasso =
  | 'administrativo'
  | 'coordenacao'
  | 'gci'
  | 'consultores'
  | 'comercial'
  | 'cliente';

export interface EmailDePasso {
  passo: number;
  para: DestinatarioPasso[];
  assunto: string;
  corpo: string;
}

/** Tokens disponíveis no assunto e no corpo — os mesmos da tela de modelos de e-mail. */
export const TOKENS_PASSO: Record<string, string> = {
  '{{CLIENTE}}': 'cliente',
  '{{NUMERO_PROJETO}}': 'numeroProjeto',
  '{{GCI}}': 'gci',
  '{{CONSULTOR}}': 'consultor',
  '{{CONTATO_NOME}}': 'contatoNome',
  '{{DATA_LEVANTAMENTO}}': 'dataLevantamento',
  '{{DATA_ENCERRAMENTO}}': 'dataEncerramento',
};

const ASSINATURA =
  '\n\nAtenciosamente,\nEquipe de Implantação — Rech Sistemas de Gestão';

export const EMAILS_POR_PASSO: EmailDePasso[] = [
  {
    passo: 1,
    para: ['administrativo'],
    assunto: 'Novo cliente cadastrado — {{CLIENTE}}',
    corpo:
      'O Comercial cadastrou a {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) no Painel, a ' +
      'partir da consulta ao SICLA.\n\nPróximo passo: agendar o Levantamento de Processo e ' +
      'indicar o(s) levantador(es).' +
      ASSINATURA,
  },
  {
    passo: 4,
    para: ['comercial'],
    assunto: 'Levantamento realizado — {{CLIENTE}}',
    corpo:
      'O levantamento de processos da {{CLIENTE}} foi realizado.\n\nSeguem abaixo as ' +
      'informações relevantes identificadas, para a continuidade da negociação:\n\n' +
      '(descreva aqui o que foi encontrado)' +
      ASSINATURA,
  },
  {
    passo: 6,
    para: ['coordenacao'],
    assunto: 'Contrato assinado — indicar responsáveis — {{CLIENTE}}',
    corpo:
      'O contrato da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi assinado e a ' +
      'implantação está liberada.\n\nPróximo passo: indicar o GCI e os técnicos ' +
      'responsáveis pela implantação.' +
      ASSINATURA,
  },
  {
    passo: 7,
    para: ['gci', 'consultores', 'administrativo'],
    assunto: 'Você é responsável pela implantação — {{CLIENTE}}',
    corpo:
      'A implantação da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi atribuída à ' +
      'equipe.\n\nGCI: {{GCI}}\nConsultor(es): {{CONSULTOR}}\n\n' +
      'Administrativo: seguir com a inclusão da RNI e das RNS de COB e Conversão.' +
      ASSINATURA,
  },
  {
    passo: 8,
    para: ['gci', 'consultores'],
    assunto: 'RNS incluídas — liberado para Projeto e Cronograma — {{CLIENTE}}',
    corpo:
      'As RNS da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foram incluídas.\n\n' +
      'GCI: liberado para elaborar o Projeto de Implantação.\n' +
      'Consultor(es): liberado para elaborar o Cronograma e incluir as agendas no SICLA.\n\n' +
      'As duas frentes correm em paralelo.' +
      ASSINATURA,
  },
  {
    passo: 9,
    para: ['administrativo'],
    assunto: 'Projeto elaborado — conferir e encaminhar — {{CLIENTE}}',
    corpo:
      'O Projeto de Implantação da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi ' +
      'elaborado pelo GCI {{GCI}}.\n\nPróximo passo: conferir, validar com o GCI ou o ' +
      'Coordenador e encaminhar para assinatura.' +
      ASSINATURA,
  },
  {
    passo: 11,
    para: ['cliente'],
    assunto: 'Cronograma de Implantação — {{CLIENTE}}',
    corpo:
      'Prezado(a) {{CONTATO_NOME}},\n\nSegue o cronograma de implantação do SIGER®, com as ' +
      'agendas e os macro tópicos de cada visita/treinamento.\n\nPor favor, confirme as ' +
      'datas ou retorne com ajustes.' +
      ASSINATURA,
  },
  {
    passo: 13,
    para: ['cliente'],
    assunto: 'Boas-vindas à implantação do SIGER® — {{CLIENTE}}',
    corpo:
      'Prezado(a) {{CONTATO_NOME}},\n\nSeja bem-vindo(a) à implantação do ERP SIGER®.\n\n' +
      'Nesta etapa você recebe o material de apoio: os vídeos de treinamento e o BI de ' +
      'Implantação, que acompanham o andamento do projeto.\n\n' +
      'Seu consultor responsável é {{CONSULTOR}}.' +
      ASSINATURA,
  },
  {
    passo: 16,
    para: ['administrativo'],
    assunto: 'Termo de Encerramento gerado — conferir — {{CLIENTE}}',
    corpo:
      'O Termo de Encerramento da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi gerado.\n\n' +
      'Próximo passo: conferir, validar com o GCI ou o Coordenador e encaminhar para ' +
      'assinatura.' +
      ASSINATURA,
  },
  {
    passo: 17,
    para: ['consultores'],
    assunto: 'Termo conferido — seguir com o encerramento — {{CLIENTE}}',
    corpo:
      'O Termo de Encerramento da {{CLIENTE}} foi conferido e encaminhado para assinatura.\n\n' +
      'Próximo passo: enviar os e-mails de encerramento ao Coordenador/GCI e ao cliente.' +
      ASSINATURA,
  },
  {
    passo: 18,
    para: ['coordenacao', 'gci'],
    assunto: 'Encerramento de Implantação — {{CLIENTE}}',
    corpo:
      'A implantação da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi encerrada em ' +
      '{{DATA_ENCERRAMENTO}}.\n\nO cliente passa a ser atendido pelo setor de Suporte.' +
      ASSINATURA,
  },
  {
    passo: 19,
    para: ['cliente'],
    assunto: 'Encerramento da implantação do SIGER® — {{CLIENTE}}',
    corpo:
      'Prezado(a) {{CONTATO_NOME}},\n\nComunicamos o encerramento da implantação do ERP ' +
      'SIGER® na {{CLIENTE}}.\n\nA partir de agora, o atendimento passa a ser feito pelo ' +
      'setor de Suporte da Rech® — telefone (51) 3582.4001 e suporte@rech.com.br.\n\n' +
      'O Termo de Encerramento segue em anexo.' +
      ASSINATURA,
  },
];

export const EMAIL_POR_PASSO = new Map(
  EMAILS_POR_PASSO.map((e) => [e.passo, e]),
);

/** Passo → tipo de documento que o e-mail leva EM ANEXO.
 *
 * Só onde o texto promete o arquivo E existe um documento gerado daquele tipo: o Cronograma
 * ("Segue o cronograma…") no passo 11 e o Termo ("segue em anexo") no passo 19. Anexa-se o
 * documento mais RECENTE daquele tipo no projeto; se não houver, o e-mail sai só com o texto
 * (o envio ignora anexo ausente sem falhar). */
export const ANEXO_POR_PASSO: Record<number, string> = {
  11: 'cronograma',
  19: 'termo',
};
