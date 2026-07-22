import { Etapa, Perfil } from '../common/constants/perfis';

/** Os 18 passos operacionais do processo de implantação, conforme revisão do usuário em
 * 2026-07-22.
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

/** Papel responsável por executar o passo. "Automatico" é o robô da caixa de entrada. */
export type ResponsavelPasso =
  | 'Automatico'
  | 'Administrativo'
  | 'Levantador'
  | 'Coordenador'
  | 'GCI'
  | 'Consultor';

export interface DefinicaoPasso {
  /** Número do passo no processo (1 a 18) — é a identidade estável, usada no banco. */
  numero: number;
  titulo: string;
  /** Macro-etapa a que o passo pertence. */
  etapa: Etapa;
  responsavel: ResponsavelPasso;
  /** Passos que precisam estar concluídos para este poder ser concluído. Vazio = nenhum.
   * É o que permite as duas trilhas paralelas a partir do passo 7. */
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
  // Passo 1 é do robô; ADM aparece para permitir reprocessar à mão quando o robô falha.
  Automatico: ['ADM'],
  Administrativo: ['ADM', 'Administrativo'],
  // Levantador e Consultor são o mesmo perfil no sistema; o que distingue é o papel no
  // projeto (ver entidade ProjetoPessoa).
  Levantador: ['ADM', 'Consultor'],
  Coordenador: ['ADM', 'Coordenador'],
  GCI: ['ADM', 'GCI'],
  Consultor: ['ADM', 'Consultor'],
};

export const PASSOS: DefinicaoPasso[] = [
  {
    numero: 1,
    titulo: 'Recebimento do e-mail do Comercial',
    etapa: 'Agendamento',
    responsavel: 'Automatico',
    depende: [],
    irreversivel: false,
    email: 'Avisa o Administrativo de que chegou um fechamento.',
    observacao:
      'O robô lê a caixa de entrada, extrai os campos do e-mail e cria a ficha do projeto.',
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
    titulo: 'Repassar informações do levantamento ao Comercial',
    etapa: 'Levantamento',
    responsavel: 'Levantador',
    depende: [2],
    irreversivel: false,
    email: 'Envia ao Comercial o que foi identificado no levantamento.',
    observacao:
      'Pode ser enviado pelo Painel ou apenas registrado, anexando o e-mail encaminhado pelo Outlook.',
  },
  {
    numero: 4,
    titulo: 'Finalizar negociação e enviar o fechamento',
    etapa: 'Levantamento',
    responsavel: 'Administrativo',
    depende: [3],
    irreversivel: false,
    observacao:
      'Conferência manual do Administrativo. O registro é o e-mail encaminhado pelo Outlook, anexado ao projeto.',
  },
  {
    numero: 5,
    titulo: 'Contrato assinado e liberação para indicar os responsáveis',
    etapa: 'Levantamento',
    responsavel: 'Administrativo',
    depende: [4],
    irreversivel: false,
    email: 'Avisa o Coordenador de que pode indicar os responsáveis.',
  },
  {
    numero: 6,
    titulo: 'Indicar o GCI e os técnicos responsáveis',
    etapa: 'Designação',
    responsavel: 'Coordenador',
    depende: [5],
    irreversivel: false,
    email:
      'Comunica o GCI e os consultores de que são responsáveis pela implantação, e avisa o Administrativo para seguir.',
    observacao: 'O GCI é único; os consultores podem ser vários.',
  },
  {
    numero: 7,
    titulo: 'Incluir a RNI e as RNS de COB e Conversão',
    etapa: 'Designação',
    responsavel: 'Administrativo',
    depende: [6],
    irreversivel: false,
    email:
      'Libera o GCI para elaborar o Projeto e os consultores para elaborar o Cronograma.',
    observacao:
      'A quantidade de RNS é variável — o Administrativo acrescenta quantos registros precisar. Daqui saem DUAS trilhas paralelas: Projeto (8-9) e Cronograma (10-13).',
  },
  {
    numero: 8,
    titulo: 'Criação do Projeto',
    etapa: 'Projeto',
    responsavel: 'GCI',
    depende: [7],
    irreversivel: false,
    email:
      'Pede ao Administrativo a conferência e o encaminhamento para assinatura.',
  },
  {
    numero: 9,
    titulo: 'Conferência do Projeto e envio para assinatura',
    etapa: 'Projeto',
    responsavel: 'Administrativo',
    depende: [8],
    irreversivel: false,
    observacao:
      'Exige a marcação de conferido (validada com GCI ou Coordenador) para liberar a etapa seguinte.',
  },
  {
    numero: 10,
    titulo: 'Elaborar o cronograma e incluir as agendas no SICLA',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [7],
    irreversivel: false,
    email: 'Envia o cronograma ao cliente para validar as datas.',
    observacao:
      'NÃO depende do passo 8: corre em paralelo com a trilha do Projeto.',
  },
  {
    numero: 11,
    titulo: 'Gerar o check-list',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [10],
    irreversivel: true,
  },
  {
    numero: 12,
    titulo: 'Encaminhar e-mail de boas-vindas',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [11],
    irreversivel: true,
    email: 'E-mail descritivo ao cliente, com os vídeos e o BI de Implantação.',
  },
  {
    numero: 13,
    titulo: 'Enviar o cronograma de visitas',
    etapa: 'Cronograma e Check-list',
    responsavel: 'Consultor',
    depende: [12],
    irreversivel: true,
  },
  {
    numero: 14,
    titulo: 'Sinalizar Projeto concluído',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [13],
    irreversivel: true,
    observacao: 'Registra a data de conclusão do projeto.',
  },
  {
    numero: 15,
    titulo: 'Gerar o Termo de Encerramento e enviar ao Administrativo',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [14],
    irreversivel: true,
    email: 'Avisa o Administrativo para conduzir a conferência.',
  },
  {
    numero: 16,
    titulo: 'Conferir o Termo e encaminhar para assinatura',
    etapa: 'Encerramento',
    responsavel: 'Administrativo',
    depende: [15],
    irreversivel: true,
    email: 'Avisa o consultor para conduzir o encerramento.',
    observacao:
      'Exige a marcação de conferido, validada com GCI ou Coordenador.',
  },
  {
    numero: 17,
    titulo: 'E-mail de Encerramento ao Coordenador e ao GCI',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [16],
    irreversivel: true,
  },
  {
    numero: 18,
    titulo: 'E-mail de Encerramento ao cliente, com o Termo',
    etapa: 'Encerramento',
    responsavel: 'Consultor',
    depende: [17],
    irreversivel: true,
  },
];

export const PASSOS_POR_NUMERO = new Map(PASSOS.map((p) => [p.numero, p]));

/** Passos que exigem a marcação explícita de "conferido" antes de liberar o seguinte. */
export const PASSOS_COM_CONFERENCIA = new Set([9, 16]);
