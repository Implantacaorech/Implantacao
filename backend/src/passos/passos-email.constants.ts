/** Quem recebe o e-mail de cada passo e o que ele diz.
 *
 * O mapa dos passos (`passos.constants.ts`) descreve o e-mail em linguagem de negócio; aqui
 * está o contrato executável: destinatários e texto. Separado de propósito — o processo
 * (quem faz o quê) muda por decisão de negócio; o texto do e-mail muda por redação.
 *
 * O que está aqui é o PADRÃO. Dois pontos de configuração ficam por cima dele, e ambos
 * vencem quando existem:
 *   - texto — modelo de e-mail do passo (slug `passo-N`), editável em Sistema → Ferramentas
 *     → Modelos de E-mail;
 *   - destinatários — `destinatarios_passo`, editável em Sistema → Ferramentas →
 *     Destinatários por Passo. É lá que entram, por exemplo, os dois grupos avisados no
 *     passo 1, que são endereços da Rech e não cabem no código. */

/** Grupos de destinatário que o sistema sabe resolver sozinho, a partir do projeto. */
export type DestinatarioPasso =
  | 'administrativo'
  | 'coordenacao'
  | 'gci'
  | 'consultores'
  | 'levantadores'
  | 'comercial'
  | 'cliente';

/** Rótulo de cada grupo para a tela de configuração — o ADM escolhe por nome, não por slug. */
export const ROTULO_DESTINATARIO: Record<DestinatarioPasso, string> = {
  administrativo: 'Administrativo (perfil)',
  coordenacao: 'Coordenação e ADM (perfil)',
  gci: 'GCI do projeto',
  consultores: 'Consultores designados',
  levantadores: 'Levantadores designados',
  comercial: 'Comercial do projeto',
  cliente: 'Contato no cliente',
};

export interface EmailDePasso {
  passo: number;
  para: DestinatarioPasso[];
  assunto: string;
  corpo: string;
}

/** Tokens disponíveis no assunto e no corpo — os mesmos da tela de modelos de e-mail.
 *
 * `_descricaoPasso`, `_dataMarcada` e `_levantadores` não são colunas do projeto: vêm do
 * registro do passo (a descrição que a pessoa escreveu, a data de assinatura que ela marcou)
 * e dos vínculos por papel. São resolvidos em runtime pelo serviço de notificação. */
export const TOKENS_PASSO: Record<string, string> = {
  '{{CLIENTE}}': 'cliente',
  '{{CNPJ}}': 'cnpj',
  '{{NUMERO_PROJETO}}': 'numeroProjeto',
  '{{GCI}}': 'gci',
  '{{CONSULTOR}}': 'consultor',
  '{{CONTATO_NOME}}': 'contatoNome',
  '{{CONTATO_EMAIL}}': 'contatoEmail',
  '{{DATA_LEVANTAMENTO}}': 'dataLevantamento',
  '{{DATA_ENCERRAMENTO}}': 'dataEncerramento',
  '{{MODULOS}}': 'modulos',
  '{{LEVANTADOR}}': '_levantadores',
  '{{DESCRICAO_PASSO}}': '_descricaoPasso',
  '{{DATA_ASSINATURA}}': '_dataMarcada',
};

const ASSINATURA =
  '\n\nAtenciosamente,\nEquipe de Implantação — Rech Sistemas de Gestão';

export const EMAILS_POR_PASSO: EmailDePasso[] = [
  {
    passo: 1,
    // Além do Administrativo, o passo 1 avisa DOIS grupos de e-mail da Rech. Como são
    // endereços internos (e mudam sem mexer em código), eles entram pela tela de
    // Destinatários por Passo, não aqui.
    para: ['administrativo'],
    assunto: 'Novo cliente cadastrado — {{CLIENTE}}',
    corpo:
      'O Comercial cadastrou a {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) no Painel, a ' +
      'partir da consulta ao SICLA.\n\nPróximo passo: agendar o Levantamento de Processo e ' +
      'indicar o(s) levantador(es).' +
      ASSINATURA,
  },
  {
    passo: 2,
    para: ['levantadores'],
    assunto: 'Levantamento agendado — {{CLIENTE}} — {{DATA_LEVANTAMENTO}}',
    corpo:
      'Olá, {{LEVANTADOR}}!\n\nVocê foi designado(a) para o levantamento de processos da ' +
      '{{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}).\n\n' +
      'Data e horário: {{DATA_LEVANTAMENTO}}\n' +
      'Contato no cliente: {{CONTATO_NOME}}\n\n' +
      'Ao concluir, registre o levantamento no Painel e repasse as informações ao Comercial.' +
      ASSINATURA,
  },
  {
    passo: 4,
    para: ['comercial'],
    assunto: 'Levantamento realizado — {{CLIENTE}}',
    corpo:
      'O levantamento de processos da {{CLIENTE}} foi realizado por {{LEVANTADOR}}.\n\n' +
      'Seguem as informações relevantes identificadas, para a continuidade da negociação:\n\n' +
      '{{DESCRICAO_PASSO}}' +
      ASSINATURA,
  },
  {
    passo: 5,
    para: ['administrativo'],
    assunto: 'Negociação liberada para fechamento — {{CLIENTE}}',
    corpo:
      'O Comercial concluiu a análise do levantamento da {{CLIENTE}} (projeto nº ' +
      '{{NUMERO_PROJETO}}) e liberou a negociação para finalização.\n\n' +
      'Descrição do Comercial:\n\n{{DESCRICAO_PASSO}}\n\n' +
      'Próximo passo: finalizar a negociação e enviar o fechamento ao cliente.' +
      ASSINATURA,
  },
  {
    passo: 7,
    para: ['coordenacao'],
    assunto: 'Contrato assinado — indicar responsáveis — {{CLIENTE}}',
    corpo:
      'O contrato da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi assinado em ' +
      '{{DATA_ASSINATURA}} e a implantação está liberada.\n\n' +
      'A implantação aguarda a sinalização do GCI e dos técnicos responsáveis.' +
      ASSINATURA,
  },
  {
    passo: 8,
    para: ['gci', 'consultores', 'administrativo'],
    assunto: 'Você é responsável pela implantação — {{CLIENTE}}',
    corpo:
      'A implantação da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi atribuída à ' +
      'equipe.\n\nGCI: {{GCI}}\nTécnico(s): {{CONSULTOR}}\nMódulos: {{MODULOS}}\n\n' +
      'GCI: liberado para elaborar o Projeto de Implantação.\n' +
      'Técnico(s): liberado para elaborar o Cronograma e incluir as agendas no SICLA.\n' +
      'Administrativo: seguir com a inclusão da RNI e das RNS de COB e Conversão.\n\n' +
      'As frentes correm em paralelo.' +
      ASSINATURA,
  },
  {
    passo: 10,
    para: ['administrativo'],
    assunto: 'Projeto finalizado — pronto para revisão — {{CLIENTE}}',
    corpo:
      'O Projeto de Implantação da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi ' +
      'finalizado pelo GCI {{GCI}} e está pronto para a revisão e o envio ao cliente.\n\n' +
      'Próximo passo: conferir o Projeto e encaminhar para assinatura.' +
      ASSINATURA,
  },
  {
    passo: 11,
    para: ['coordenacao'],
    assunto: 'Projeto enviado para assinatura — {{CLIENTE}}',
    corpo:
      'O Projeto de Implantação da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi ' +
      'conferido pelo Administrativo e enviado ao cliente para assinatura.' +
      ASSINATURA,
  },
  // Passo 13 ("Elaborar o cronograma e incluir as agendas no SICLA") NÃO tem e-mail: é
  // trabalho interno, e o cronograma que o cliente recebe é o do passo 16 (decisão do usuário
  // em 2026-07-30). Não recriar a entrada aqui sem mudar a regra em passos.constants.ts.
  {
    passo: 15,
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
    para: ['cliente'],
    assunto: 'Cronograma de visitas — {{CLIENTE}}',
    corpo:
      'Prezado(a) {{CONTATO_NOME}},\n\nSegue o cronograma de visitas da implantação do ' +
      'SIGER®, com as datas e os temas de cada encontro.\n\n' +
      'Qualquer necessidade de ajuste, fale com {{CONSULTOR}}.' +
      ASSINATURA,
  },
  {
    passo: 17,
    para: ['coordenacao', 'gci', 'administrativo'],
    assunto: 'Projeto concluído — {{CLIENTE}}',
    corpo:
      'O projeto de implantação da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi ' +
      'concluído em {{DATA_ENCERRAMENTO}}.\n\n' +
      'Próximo passo: gerar o Termo de Encerramento.' +
      ASSINATURA,
  },
  {
    passo: 18,
    para: ['administrativo'],
    assunto: 'Termo de Encerramento gerado — conferir — {{CLIENTE}}',
    corpo:
      'O Termo de Encerramento da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi gerado ' +
      'e segue em anexo.\n\n' +
      'Próximo passo: conferir, validar com o GCI ou o Coordenador e encaminhar para ' +
      'assinatura.' +
      ASSINATURA,
  },
  {
    passo: 19,
    para: ['consultores'],
    assunto: 'Termo conferido — seguir com o encerramento — {{CLIENTE}}',
    corpo:
      'O Termo de Encerramento da {{CLIENTE}} foi conferido e encaminhado para assinatura.\n\n' +
      'Próximo passo: enviar os e-mails de encerramento ao Coordenador/GCI e ao cliente.' +
      ASSINATURA,
  },
  {
    passo: 20,
    para: ['coordenacao', 'gci'],
    assunto: 'Encerramento de Implantação — {{CLIENTE}}',
    corpo:
      'A implantação da {{CLIENTE}} (projeto nº {{NUMERO_PROJETO}}) foi encerrada em ' +
      '{{DATA_ENCERRAMENTO}}.\n\nO cliente passa a ser atendido pelo setor de Suporte.' +
      ASSINATURA,
  },
  {
    passo: 21,
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
 * Só onde o texto promete o arquivo E existe um documento gerado daquele tipo. Anexa-se o
 * documento mais RECENTE daquele tipo no projeto; se não houver, o e-mail sai só com o texto
 * (o envio ignora anexo ausente sem falhar). */
export const ANEXO_POR_PASSO: Record<number, string> = {
  11: 'projeto',
  16: 'cronograma',
  18: 'termo',
  21: 'termo',
};
