import {
  Etapa,
  Perfil,
  PERFIS_GERA_CRONOGRAMA,
  PERFIS_GERA_LEVANTAMENTO,
} from '../common/constants/perfis';

/** Os 21 passos operacionais do processo de implantação (revisão do usuário em 2026-07-30;
 * antes eram 19 — o passo 3 "Realizar o Levantamento" entrou em 2026-07-28).
 *
 * Eles NÃO substituem as 6 macro-etapas (`ETAPAS` em common/constants/perfis.ts): cada passo
 * pertence a uma macro-etapa, que continua sendo o que aparece no painel, nas métricas e nos
 * filtros. O passo é a tarefa — tem um responsável, um gate e, às vezes, um e-mail.
 *
 * Vocabulário do processo (para não haver dúvida ao ler o código):
 *   TÉCNICO   = Consultor
 *   GCI       = Gerente de Contas de Implantação — é ÚNICO por projeto
 *   LEVANTADOR = quem faz o levantamento de processos; pode ser mais de um
 *   Consultor  = pode ser mais de um por projeto
 *
 * REVISÃO DE 2026-07-30 — dois passos novos e a renumeração que eles causaram:
 *   passo 5  (NOVO, Comercial)      "Avançar para finalização da negociação"
 *   passo 12 (NOVO, Administrativo) "Sinalizar Projeto assinado"
 *
 * O de/para aplicado aos dados já gravados (ver a migration `RenumerarPassos21`):
 *   1-4 → iguais · 5-10 → +1 (viram 6-11) · 11-19 → +2 (viram 13-21)
 * Quem mexer nos números daqui PRECISA migrar `projeto_passos.passo` junto — a numeração é
 * a identidade do passo no banco, não um rótulo de exibição. */

/** Papel responsável por executar o passo. "Comercial" abre o processo consultando o cliente
 * no SICLA e completando o cadastro (passo 1). "Automatico" é o antigo robô da caixa de
 * entrada — mantido no tipo por compatibilidade, mas nenhum passo o usa mais desde que a
 * entrada passou a ser a consulta ao SICLA (revisão de 2026-07-27). */
export type ResponsavelPasso =
  | 'Comercial'
  | 'Automatico'
  | 'Administrativo'
  | 'Levantador'
  | 'Coordenador'
  | 'GCI'
  | 'Consultor';

export interface DefinicaoPasso {
  /** Número do passo no processo (1 a 19) — é a identidade estável, usada no banco. */
  numero: number;
  titulo: string;
  /** Macro-etapa a que o passo pertence. */
  etapa: Etapa;
  responsavel: ResponsavelPasso;
  /** Passos que precisam estar concluídos para este poder ser concluído. Vazio = nenhum.
   * É o que permite as duas trilhas paralelas a partir do passo 8. */
  depende: number[];
  /** Depois de concluído, não pode ser desmarcado. */
  irreversivel: boolean;
  /** O que o passo dispara de e-mail, em linguagem de negócio (a montagem fica no serviço
   * de e-mail; aqui é só a documentação do contrato do processo). */
  email?: string;
  observacao?: string;
}

/** Perfis do sistema que podem executar cada papel do processo. ADM entra em todos por ser o
 * perfil de administração do Painel. */
export const PERFIS_POR_RESPONSAVEL: Record<ResponsavelPasso, Perfil[]> = {
  // Passo 1 é do Comercial: consulta o cliente no SICLA e completa o cadastro. Podem cadastrar
  // novo cliente ADM, Comercial e Coordenador (definição do usuário em 2026-07-27); o
  // Administrativo deixou de fazer o cadastro (só é avisado por e-mail e segue no passo 2).
  Comercial: ['ADM', 'Comercial', 'Coordenador'],
  // 'Automatico' não é mais usado por nenhum passo (a entrada virou a consulta ao SICLA);
  // mantido só para não quebrar referências antigas. ADM para reprocessar à mão.
  Automatico: ['ADM'],
  Administrativo: ['ADM', 'Administrativo'],
  // Levantador virou papel PRÓPRIO (revisão de 2026-07-22) — na prática são os GCIs, mas
  // quem marca isso é o cadastro do usuário, e uma pessoa acumula cargos.
  Levantador: ['ADM', 'Levantador'],
  Coordenador: ['ADM', 'Coordenador'],
  GCI: ['ADM', 'GCI'],
  Consultor: ['ADM', 'Consultor'],
};

/** Passos cuja ação acontece em OUTRA TELA (o passo só leva até lá) e quem pode ABRIR essa
 * tela.
 *
 * ABRIR é permissão DIFERENTE de CONCLUIR, e confundir as duas trancava gente fora do
 * trabalho (correção de 2026-07-29): concluir o passo 3 é do Levantador DESIGNADO — é ele
 * quem responde por o levantamento ter sido feito —, mas PREENCHER o questionário é de quem
 * entra na tela do Levantamento. Enquanto o botão "Abrir" seguia a permissão de concluir,
 * quem não fosse o levantador designado (o GCI, o Coordenador, o Administrativo) via o
 * botão e não conseguia entrar.
 *
 * As listas são as MESMAS que a tela de destino já aplica — `@Roles` do controller e o
 * `perfilGuard` da rota no frontend —, para o botão não prometer o que a tela recusa. */
export const PERFIS_TELA_DO_PASSO: Record<number, Perfil[]> = {
  // 3 = Levantamento (LevantamentoController usa PERFIS_GERA_LEVANTAMENTO).
  3: PERFIS_GERA_LEVANTAMENTO,
  // 10 = Gerar Projeto — mesma lista de `podeGerar('projeto')`.
  10: PERFIS_GERA_LEVANTAMENTO,
  // 11 = Conferência do Projeto: o Administrativo abre o Projeto no layout da Rech para
  // revisar e baixar antes de mandar ao cliente. Quem confere é o Administrativo, mas o GCI
  // e a Coordenação validam junto — mesma lista de quem gera o documento.
  11: PERFIS_GERA_LEVANTAMENTO,
  // 13 = Agenda de Visitas e 14 = Check-list, ambos da trilha do cronograma.
  13: PERFIS_GERA_CRONOGRAMA,
  14: PERFIS_GERA_CRONOGRAMA,
};

export const PASSOS: DefinicaoPasso[] = [
  {
    numero: 1,
    titulo: 'Consulta e Cadastro do Cliente',
    etapa: 'Agendamento',
    responsavel: 'Comercial',
    depende: [],
    irreversivel: false,
    email: 'Avisa o Administrativo de que um novo cliente foi cadastrado.',
    observacao:
      'O Comercial busca o cliente no SICLA (por código ou descrição), os dados vêm ' +
      'pré-preenchidos e ele completa o que faltar. Concluir cria a ficha do projeto.',
  },
  {
    numero: 2,
    titulo: 'Agendar Levantamento de Processo',
    etapa: 'Agendamento',
    responsavel: 'Administrativo',
    depende: [1],
    irreversivel: false,
    email:
      'Avisa o(s) levantador(es) designado(s) do cliente, da data e do horário agendados.',
    observacao:
      'Define a data da visita e os levantadores. Pode haver mais de um levantador, mas a data é a MESMA para todos.',
  },
  {
    numero: 3,
    titulo: 'Realizar o Levantamento de Processo',
    etapa: 'Levantamento',
    responsavel: 'Levantador',
    depende: [2],
    irreversivel: false,
    observacao:
      'O(s) levantador(es) realizam o levantamento/mapeamento dos processos do cliente na ' +
      'data agendada. Concluir marca que o levantamento foi feito; o retorno ao Comercial é o passo seguinte.',
  },
  {
    numero: 4,
    titulo: 'Repassar informações do levantamento ao Comercial',
    etapa: 'Levantamento',
    responsavel: 'Levantador',
    depende: [3],
    irreversivel: false,
    email: 'Envia ao Comercial o que foi identificado no levantamento.',
    observacao:
      'Pode ser enviado pelo Painel ou apenas registrado, anexando o e-mail encaminhado pelo Outlook.',
  },
  {
    numero: 5,
    titulo: 'Avançar para finalização da negociação',
    etapa: 'Levantamento',
    responsavel: 'Comercial',
    depende: [4],
    irreversivel: false,
    email:
      'Leva ao Administrativo a descrição escrita aqui, para ele finalizar a negociação e enviar o fechamento.',
    observacao:
      'O Comercial descreve o que ficou acertado na negociação; essa descrição vai NO CORPO do e-mail do responsável pelo passo seguinte.',
  },
  {
    numero: 6,
    titulo: 'Finalizar negociação e enviar o fechamento',
    etapa: 'Levantamento',
    responsavel: 'Administrativo',
    depende: [5],
    irreversivel: false,
    observacao:
      'Conferência manual do Administrativo. O registro é o e-mail encaminhado pelo Outlook, anexado ao projeto.',
  },
  {
    numero: 7,
    titulo: 'Contrato assinado e liberação para indicar os responsáveis',
    etapa: 'Levantamento',
    responsavel: 'Administrativo',
    depende: [6],
    irreversivel: false,
    email:
      'Avisa o Coordenador de que a implantação aguarda a indicação do GCI e dos técnicos.',
    observacao:
      'Exige marcar que o contrato foi assinado e informar a data da assinatura.',
  },
  {
    numero: 8,
    titulo: 'Indicar o GCI e os técnicos responsáveis',
    etapa: 'Designação',
    responsavel: 'Coordenador',
    depende: [7],
    irreversivel: false,
    email:
      'Comunica o GCI, os técnicos e o Administrativo de que a equipe está definida.',
    observacao: 'O GCI é único; os consultores podem ser vários.',
  },
  {
    numero: 9,
    titulo: 'Incluir a RNI e as RNS de COB e Conversão',
    etapa: 'Designação',
    responsavel: 'Administrativo',
    depende: [8],
    irreversivel: false,
    observacao:
      'A quantidade de RNS é variável — o Administrativo acrescenta quantos registros precisar. NÃO envia e-mail e NÃO tranca as próximas: nada depende deste passo.',
  },
  {
    numero: 10,
    titulo: 'Criação do Projeto',
    etapa: 'Projeto',
    responsavel: 'GCI',
    depende: [8],
    irreversivel: false,
    email:
      'Avisa o Administrativo de que o Projeto está pronto para revisão e envio ao cliente.',
    observacao:
      'Não depende do passo 9 e não tranca a trilha do cronograma (13+) — só a conferência (11) espera por ele.',
  },
  {
    numero: 11,
    titulo: 'Conferência do Projeto e envio para assinatura',
    etapa: 'Projeto',
    responsavel: 'Administrativo',
    depende: [10],
    irreversivel: false,
    email: 'Sinaliza ao Coordenador que o Projeto foi enviado para assinatura.',
    observacao:
      'O Administrativo visualiza o Projeto no layout da Rech, baixa o arquivo e envia ao cliente daqui mesmo. Exige a marcação de conferido para liberar o passo 12.',
  },
  {
    numero: 12,
    titulo: 'Sinalizar Projeto assinado',
    etapa: 'Projeto',
    responsavel: 'Administrativo',
    depende: [11],
    irreversivel: false,
    observacao:
      'Marca que o Projeto foi assinado e registra a data da assinatura. Não tranca a trilha do cronograma.',
  },
  {
    numero: 13,
    titulo: 'Elaborar o cronograma e incluir as agendas no SICLA',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [8],
    irreversivel: false,
    // SEM e-mail (decisão do usuário em 2026-07-30): elaborar o cronograma é trabalho
    // INTERNO. Quem leva o cronograma ao cliente é o passo 16 ("Enviar o cronograma de
    // visitas"), que já sai com o documento em anexo — mandar antes, aqui, entregava ao
    // cliente uma versão que o consultor ainda podia refazer.
    observacao:
      'Depende só do passo 8: corre em paralelo às trilhas da RNS (9) e do Projeto (10-12). O consultor pode refazer o cronograma quantas vezes quiser — o passo só se conclui quando ele marcar o cronograma como finalizado. Não envia e-mail ao cliente: quem faz isso é o passo 16.',
  },
  {
    numero: 14,
    titulo: 'Gerar o check-list',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [13],
    irreversivel: true,
  },
  {
    numero: 15,
    titulo: 'Encaminhar e-mail de boas-vindas',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [14],
    irreversivel: true,
    email: 'E-mail descritivo ao cliente, com os vídeos e o BI de Implantação.',
  },
  {
    numero: 16,
    titulo: 'Enviar o cronograma de visitas',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [15],
    irreversivel: true,
    email: 'Envia ao cliente o cronograma de visitas.',
  },
  {
    numero: 17,
    titulo: 'Sinalizar Projeto concluído',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [16],
    irreversivel: true,
    email: 'Comunica a conclusão do projeto.',
    observacao: 'Registra a data de conclusão do projeto.',
  },
  {
    numero: 18,
    titulo: 'Gerar o Termo de Encerramento e enviar ao Administrativo',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [17],
    irreversivel: true,
    email: 'Avisa o Administrativo para conduzir a conferência.',
  },
  {
    numero: 19,
    titulo: 'Conferir o Termo e encaminhar para assinatura',
    etapa: 'Encerramento',
    responsavel: 'Administrativo',
    depende: [18],
    irreversivel: true,
    email: 'Avisa o consultor para conduzir o encerramento.',
    observacao:
      'Exige a marcação de conferido, validada com GCI ou Coordenador.',
  },
  {
    numero: 20,
    titulo: 'E-mail de Encerramento ao Coordenador e ao GCI',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [19],
    irreversivel: true,
    email: 'Encerramento da implantação ao Coordenador e ao GCI.',
  },
  {
    numero: 21,
    titulo: 'E-mail de Encerramento ao cliente, com o Termo',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [20],
    irreversivel: true,
    email: 'Encerramento ao cliente, com o Termo em anexo.',
  },
];

export const PASSOS_POR_NUMERO = new Map(PASSOS.map((p) => [p.numero, p]));

/** Passos que exigem a marcação explícita de "conferido" antes de liberar o seguinte:
 * a Conferência do Projeto (11) e a Conferência do Termo (19). */
export const PASSOS_COM_CONFERENCIA = new Set([11, 19]);

/** Passos em que o registro é o e-mail ENCAMINHADO pelo Outlook, anexado à ficha.
 *
 * Passo 4: o levantador repassa ao Comercial o que encontrou no levantamento.
 * Passo 6: o Administrativo finaliza a negociação e envia o fechamento.
 *
 * Nos dois casos o e-mail sai do Outlook da pessoa, não do Painel — o que o sistema guarda
 * é a PROVA de que aconteceu. */
export const PASSOS_COM_ANEXO_DE_EMAIL = new Set([4, 6]);

/** Passos em que a pessoa REDIGE o e-mail na tela e o Painel envia — em vez de o e-mail sair
 * pronto de um modelo, sem revisão.
 *
 * O modelo do passo continua sendo o ponto de partida (chega pré-preenchido); o que muda é
 * que a pessoa revisa destinatários, assunto e corpo antes de mandar. São os passos em que
 * o texto é sempre específico daquele cliente (passo 4, 5) ou em que o e-mail É o entregável
 * (11 e 15-21, que o usuário descreveu como "enviar o e-mail por aqui"). */
export const PASSOS_COM_REDACAO_DE_EMAIL = new Set([
  4, 5, 11, 15, 16, 17, 18, 19, 20, 21,
]);

/** Passos que exigem uma marcação + data antes de poder ser concluídos.
 *
 * O passo 7 só fecha com o contrato marcado como assinado, e o 12 com o Projeto assinado —
 * nos dois casos a DATA da assinatura é o dado que o processo cobra. Guardados em
 * `ProjetoPasso.marcado`/`dataMarcada`, genéricos de propósito: são a mesma pergunta feita
 * duas vezes, e um campo por passo faria a entidade crescer a cada revisão do processo. */
export const PASSOS_COM_MARCACAO: Record<number, string> = {
  7: 'Contrato assinado',
  12: 'Projeto assinado',
};

/** Passos em que a pessoa pode ANEXAR arquivos ao e-mail que vai sair.
 *
 * Diferente de `PASSOS_COM_ANEXO_DE_EMAIL` (4 e 6), onde o arquivo é a PROVA de um e-mail que
 * saiu por fora: aqui o arquivo VAI JUNTO no e-mail que o Painel envia.
 *
 * Só o passo 16 por enquanto — o consultor manda o cronograma de visitas e quase sempre tem
 * um material próprio para mandar junto do documento gerado. Acrescentar um número aqui
 * habilita o anexo naquele passo, desde que ele redija e-mail
 * (`PASSOS_COM_REDACAO_DE_EMAIL`). */
export const PASSOS_COM_ANEXO_LIVRE = new Set([16]);

/** Passo cuja conclusão exige que o trabalho tenha sido marcado como FINALIZADO na tela de
 * origem — o cronograma (13) pode ser refeito quantas vezes o consultor quiser, e só fecha
 * quando ele mesmo declarar que acabou. */
export const PASSO_CRONOGRAMA = 13;

/** Extensões aceitas no anexo de e-mail: formato nativo do Outlook (.msg) e o padrão
 * de e-mail exportado (.eml). */
export const EXTENSOES_EMAIL = ['.msg', '.eml'];

/** Nomes gravados num campo de equipe do projeto (`gci`, `consultor`), que guarda a lista
 * separada por vírgula.
 *
 * Devolve as PARTES **e** a string inteira, porque a vírgula é o separador mas também
 * aparece dentro de um nome ("Silva, João") — e aí o único casamento possível é o texto
 * completo. Quem consome compara contra o cadastro de usuários, então um candidato que não
 * corresponde a ninguém simplesmente não resolve: oferecer os dois é seguro e cobre os dois
 * casos. Dois achados de 2026-08-05 vinham do `split(',')` cru: com DOIS GCIs nenhum dos
 * dois recebia o e-mail do passo 8, e um GCI chamado "Silva, João" era barrado no próprio
 * passo por não bater com nenhuma das metades. */
export function nomesDoCampo(campo: string): string[] {
  const inteiro = (campo ?? '').trim();
  if (!inteiro) return [];
  const partes = inteiro
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  return [...new Set([inteiro, ...partes])];
}
