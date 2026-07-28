import { Etapa, Perfil } from '../common/constants/perfis';

/** Os 19 passos operacionais do processo de implantação (revisão do usuário em 2026-07-22;
 * o passo 3 "Realizar o Levantamento" foi (re)inserido em 2026-07-28).
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
 */

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
    titulo: 'Finalizar negociação e enviar o fechamento',
    etapa: 'Levantamento',
    responsavel: 'Administrativo',
    depende: [4],
    irreversivel: false,
    observacao:
      'Conferência manual do Administrativo. O registro é o e-mail encaminhado pelo Outlook, anexado ao projeto.',
  },
  {
    numero: 6,
    titulo: 'Contrato assinado e liberação para indicar os responsáveis',
    etapa: 'Levantamento',
    responsavel: 'Administrativo',
    depende: [5],
    irreversivel: false,
    email: 'Avisa o Coordenador de que pode indicar os responsáveis.',
  },
  {
    numero: 7,
    titulo: 'Indicar o GCI e os técnicos responsáveis',
    etapa: 'Designação',
    responsavel: 'Coordenador',
    depende: [6],
    irreversivel: false,
    email:
      'Comunica o GCI e os consultores de que são responsáveis pela implantação, e avisa o Administrativo para seguir.',
    observacao: 'O GCI é único; os consultores podem ser vários.',
  },
  {
    numero: 8,
    titulo: 'Incluir a RNI e as RNS de COB e Conversão',
    etapa: 'Designação',
    responsavel: 'Administrativo',
    depende: [7],
    irreversivel: false,
    email:
      'Libera o GCI para elaborar o Projeto e os consultores para elaborar o Cronograma.',
    observacao:
      'A quantidade de RNS é variável — o Administrativo acrescenta quantos registros precisar. Daqui saem DUAS trilhas paralelas: Projeto (9-10) e Cronograma (11-14).',
  },
  {
    numero: 9,
    titulo: 'Criação do Projeto',
    etapa: 'Projeto',
    responsavel: 'GCI',
    depende: [8],
    irreversivel: false,
    email:
      'Pede ao Administrativo a conferência e o encaminhamento para assinatura.',
  },
  {
    numero: 10,
    titulo: 'Conferência do Projeto e envio para assinatura',
    etapa: 'Projeto',
    responsavel: 'Administrativo',
    depende: [9],
    irreversivel: false,
    observacao:
      'Exige a marcação de conferido (validada com GCI ou Coordenador) para liberar a etapa seguinte.',
  },
  {
    numero: 11,
    titulo: 'Elaborar o cronograma e incluir as agendas no SICLA',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [8],
    irreversivel: false,
    email: 'Envia o cronograma ao cliente para validar as datas.',
    observacao:
      'NÃO depende do passo 9: corre em paralelo com a trilha do Projeto.',
  },
  {
    numero: 12,
    titulo: 'Gerar o check-list',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [11],
    irreversivel: true,
  },
  {
    numero: 13,
    titulo: 'Encaminhar e-mail de boas-vindas',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [12],
    irreversivel: true,
    email: 'E-mail descritivo ao cliente, com os vídeos e o BI de Implantação.',
  },
  {
    numero: 14,
    titulo: 'Enviar o cronograma de visitas',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [13],
    irreversivel: true,
  },
  {
    numero: 15,
    titulo: 'Sinalizar Projeto concluído',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [14],
    irreversivel: true,
    observacao: 'Registra a data de conclusão do projeto.',
  },
  {
    numero: 16,
    titulo: 'Gerar o Termo de Encerramento e enviar ao Administrativo',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [15],
    irreversivel: true,
    email: 'Avisa o Administrativo para conduzir a conferência.',
  },
  {
    numero: 17,
    titulo: 'Conferir o Termo e encaminhar para assinatura',
    etapa: 'Encerramento',
    responsavel: 'Administrativo',
    depende: [16],
    irreversivel: true,
    email: 'Avisa o consultor para conduzir o encerramento.',
    observacao:
      'Exige a marcação de conferido, validada com GCI ou Coordenador.',
  },
  {
    numero: 18,
    titulo: 'E-mail de Encerramento ao Coordenador e ao GCI',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [17],
    irreversivel: true,
  },
  {
    numero: 19,
    titulo: 'E-mail de Encerramento ao cliente, com o Termo',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [18],
    irreversivel: true,
  },
];

export const PASSOS_POR_NUMERO = new Map(PASSOS.map((p) => [p.numero, p]));

/** Passos que exigem a marcação explícita de "conferido" antes de liberar o seguinte:
 * a Conferência do Projeto (10) e a Conferência do Termo (17). */
export const PASSOS_COM_CONFERENCIA = new Set([10, 17]);

/** Passos em que o registro é o e-mail ENCAMINHADO pelo Outlook, anexado à ficha.
 *
 * Passo 4: o levantador repassa ao Comercial o que encontrou no levantamento.
 * Passo 5: o Administrativo finaliza a negociação e envia o fechamento.
 *
 * Nos dois casos o e-mail sai do Outlook da pessoa, não do Painel — o que o sistema guarda
 * é a PROVA de que aconteceu. */
export const PASSOS_COM_ANEXO_DE_EMAIL = new Set([4, 5]);

/** Extensões aceitas no anexo de e-mail: formato nativo do Outlook (.msg) e o padrão
 * de e-mail exportado (.eml). */
export const EXTENSOES_EMAIL = ['.msg', '.eml'];
