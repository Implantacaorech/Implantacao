import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

/** Um recurso apresentado em bloco grande (texto + imagem). */
export interface RecursoApresentado {
  /** Âncora do menu do topo. */
  id: string;
  /** Etiqueta curta acima do título — dá o "assunto" do bloco. */
  etiqueta: string;
  titulo: string;
  texto: string;
  /** Frases curtas de benefício — o que a pessoa ganha, não como funciona. */
  itens: string[];
  imagem: string;
  alt: string;
}

/**
 * Página pública de apresentação do Painel (`/apresentacao`) — a única, junto do login e do
 * "esqueci minha senha", que roda FORA do shell e SEM autenticação: ela existe justamente
 * para quem ainda não entrou.
 *
 * O texto é de NÍVEL USUÁRIO, a pedido: fala do que a pessoa faz e do que ganha, nunca de
 * tecnologia, tela interna, rota ou nome de arquivo. As imagens são ilustrações do próprio
 * Painel desenhadas em `public/apresentacao/*.svg` (não são capturas de tela reais, que
 * exporiam dados de cliente numa página aberta).
 */
@Component({
  selector: 'app-apresentacao',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './apresentacao.component.html',
  styleUrl: './apresentacao.component.css',
})
export class ApresentacaoComponent {
  constructor() {
    inject(Title).setTitle('Painel de Implantação — o que ele faz');
  }

  /** Números de destaque do topo — todos verificáveis no próprio Painel. */
  readonly destaques = [
    { valor: '21', rotulo: 'passos guiados, do 1º contato ao encerramento' },
    { valor: '5', rotulo: 'documentos oficiais gerados no modelo da Rech' },
    { valor: '1', rotulo: 'lugar só para carteira, agenda, documentos e números' },
  ];

  readonly recursos: RecursoApresentado[] = [
    {
      id: 'visao-geral',
      etiqueta: 'Ao entrar',
      titulo: 'Você abre o Painel e já sabe o que fazer hoje',
      texto:
        'A primeira tela mostra quantos clientes estão em implantação, quais estão no prazo e ' +
        'quais precisam de você agora. Cada pendência vem com o botão da ação — não é preciso ' +
        'procurar onde resolver.',
      itens: [
        'As pendências atrasadas aparecem primeiro, com o nome do cliente e o que falta',
        'Um clique leva direto à ação: designar, gerar o documento, concluir o passo',
        'O cliente em foco mostra o quanto já andou e quanto falta',
      ],
      imagem: 'apresentacao/visao-geral.svg',
      alt: 'Tela inicial do Painel com indicadores do dia e a lista de pendências priorizadas',
    },
    {
      id: 'passos',
      etiqueta: 'O processo',
      titulo: 'A implantação inteira, passo a passo, sem depender de memória',
      texto:
        'Da consulta do cliente até o e-mail de encerramento com o Termo, são 21 passos na ordem ' +
        'certa. Cada um diz quem é o responsável e só libera o seguinte quando o anterior estiver ' +
        'cumprido — assim ninguém pula etapa nem descobre tarde demais que faltava algo.',
      itens: [
        'Sempre visível: em que passo o cliente está e de quem é a vez',
        'Ao concluir um passo, os envolvidos são avisados por e-mail automaticamente',
        'Tudo que foi feito fica na linha do tempo do cliente, com data e autor',
      ],
      imagem: 'apresentacao/fluxo-passos.svg',
      alt: 'Fluxo do processo em 21 passos, com responsável, passo em aberto e passos ainda bloqueados',
    },
    {
      id: 'carteira',
      etiqueta: 'A carteira',
      titulo: 'Todos os clientes num quadro, do jeito que você prefere ver',
      texto:
        'Os projetos ficam organizados por fase, com a situação de cada um em cores. Dá para ver ' +
        'em quadro, tabela ou grade, filtrar por etapa, por situação ou só os seus — e a tela ' +
        'reabre exatamente como você deixou, mesmo de outro computador.',
      itens: [
        'No prazo, em risco, atrasado ou concluído — visível de longe',
        'Busca por cliente em qualquer tela, na barra do topo',
        'Cada cartão abre a ficha completa do cliente',
      ],
      imagem: 'apresentacao/carteira.svg',
      alt: 'Carteira de projetos em quadro, com uma coluna por fase e cartões por cliente',
    },
    {
      id: 'documentos',
      etiqueta: 'Documentos',
      titulo: 'Você responde uma vez e o documento sai pronto, no modelo da Rech',
      texto:
        'O levantamento é respondido na própria tela, com as perguntas dos módulos contratados ' +
        'agrupadas por área. Essas respostas alimentam o Projeto de Implantação sem redigitação, ' +
        'e todos os documentos saem no layout oficial — o Painel só preenche os campos.',
      itens: [
        'Levantamento, Projeto, Cronograma, Check List e Termo de Encerramento',
        'O documento pode ser conferido na tela antes de baixar ou enviar',
        'Quem prefere trazer um levantamento já feito em Word também consegue',
      ],
      imagem: 'apresentacao/documentos.svg',
      alt: 'Levantamento respondido em tela à esquerda e os documentos oficiais gerados à direita',
    },
    {
      id: 'agenda',
      etiqueta: 'Visitas',
      titulo: 'As visitas encaixadas nos dias em que o consultor está mesmo livre',
      texto:
        'O cronograma de visitas é montado arrastando cada visita para um dia e turno. O Painel ' +
        'conhece os compromissos já marcados do consultor e recusa o encaixe num horário ocupado ' +
        'ou numa data que já passou — o cronograma nasce viável.',
      itens: [
        'Manhã e tarde por dia, com o técnico e o módulo de cada visita',
        'Adiar uma visita cria a nova data e guarda a original no histórico',
        'O cronograma final é gerado em planilha para enviar ao cliente',
      ],
      imagem: 'apresentacao/agenda.svg',
      alt: 'Calendário de visitas por dia e turno, com turnos livres, ocupados e visitas alocadas',
    },
    {
      id: 'transcricao',
      etiqueta: 'Conhecimento',
      titulo: 'O que foi dito no treinamento não se perde mais',
      texto:
        'Grave a reunião pelo Painel — presencial ou pelo Teams — ou envie um vídeo já gravado. ' +
        'O áudio é transcrito e organizado em uma ficha com resumo, passo a passo numerado, ' +
        'pré-requisitos e pontos de atenção, pronta para você revisar e publicar.',
      itens: [
        'A transcrição acontece dentro da Rech: o áudio do cliente não sai daqui',
        'Conversa paralela é separada do conteúdo — e fica listada para conferência',
        'Depois de aprovada, a ficha vira material de consulta para todo o time',
      ],
      imagem: 'apresentacao/transcricao.svg',
      alt: 'Vídeo do treinamento com a transcrição ao lado e a ficha de conhecimento estruturada',
    },
    {
      id: 'equipe',
      etiqueta: 'Equipe',
      titulo: 'Quem domina o quê — e o que cada termo do SIGER® quer dizer',
      texto:
        'A Matriz de Conhecimento guarda a nota de cada técnico por competência, e cada um mantém ' +
        'a própria linha atualizada. ' +
        'menu em linguagem de negócio, alimentado pelos treinamentos já revisados.',
      itens: [
        'Enxerga rápido onde o time é forte e onde precisa de apoio',
        'Consulta que serve tanto para quem está chegando quanto para o cliente',
        'A mesma leitura desce ao nível do menu e da função do sistema',
      ],
      imagem: 'apresentacao/conhecimento.svg',
      alt: 'Matriz de conhecimento por técnico e competência ao lado do dicionário de termos',
    },
    {
      id: 'capacidade',
      etiqueta: 'Decisão',
      titulo: '"Dá para receber um cliente novo? Quem atende? A partir de quando?"',
      texto:
        'O Comercial pergunta, e a resposta sai em segundos: o Painel cruza os módulos do cliente ' +
        'novo com o que cada consultor domina, com a agenda de cada um e com quantos clientes já ' +
        'carrega — e entrega o nome e a data de início.',
      itens: [
        'Ranking com o motivo da indicação, não um número solto',
        'Mostra também a segunda opção e o que ela exigiria de apoio',
        'Evita prometer prazo que a agenda não sustenta',
      ],
      imagem: 'apresentacao/capacidade.svg',
      alt: 'Ranking de consultores para um cliente novo, com a resposta pronta ao Comercial ao lado',
    },
    {
      id: 'numeros',
      etiqueta: 'Números',
      titulo: 'Os indicadores da implantação sem ninguém montar planilha',
      texto:
        'Horas contratadas e aplicadas, percentual de utilização, contratações e conclusões por ' +
        'mês, alocação das agendas e a situação da carteira. Os números vêm do próprio dia a dia ' +
        'registrado no Painel e no SICLA — sempre atualizados.',
      itens: [
        'Visões por período, por consultor, por cliente e por RNS',
        'Os filtros que você escolheu continuam lá na próxima vez',
        'Serve para a reunião de coordenação sem preparação prévia',
      ],
      imagem: 'apresentacao/bi.svg',
      alt: 'Indicadores da implantação: horas, utilização, contratações por mês e alocação por consultor',
    },
    {
      id: 'coordenacao',
      etiqueta: 'Coordenação',
      titulo: 'A visão de quem precisa enxergar o setor inteiro',
      texto:
        'Como está cada setor, quem está sobrecarregado, o que vence nos próximos dias e o que já ' +
        'passou do prazo. É a tela para agir antes de o cliente cobrar — e para distribuir melhor ' +
        'o que está concentrado em uma pessoa só.',
      itens: [
        'Saúde por setor e carga por colaborador, lado a lado',
        'Próximas entregas em ordem de urgência',
        'Resumo diário da carteira chega por e-mail, sem ninguém pedir',
      ],
      imagem: 'apresentacao/monitoramento.svg',
      alt: 'Centro de monitoramento com saúde por setor, carga por colaborador e próximas entregas',
    },
    {
      id: 'acesso',
      etiqueta: 'Acesso',
      titulo: 'Cada pessoa encontra apenas o que é do seu papel',
      texto:
        'Comercial, Administrativo, Coordenação, GCI e Consultor entram no mesmo Painel e veem ' +
        'telas diferentes — só o que usam. O acesso é liberado pela administração do setor, e ' +
        'tudo o que é feito fica registrado no nome de quem fez.',
      itens: [
        'Menu e botões mudam conforme o papel: nada de aprender o que não se usa',
        'Login individual, com recuperação de senha pelo próprio e-mail',
        'Histórico completo por cliente: quem fez, o quê e quando',
      ],
      imagem: 'apresentacao/perfis.svg',
      alt: 'Os papéis do setor lado a lado, com o que cada um faz no Painel',
    },
  ];

  /** Recursos menores — não pedem uma imagem inteira, mas fazem falta na conversa. */
  readonly extras = [
    {
      titulo: 'E-mails já escritos',
      texto: 'Boas-vindas, encaminhamento, cobrança e encerramento saem de modelos prontos, já com os dados do cliente.',
    },
    {
      titulo: 'Check-list da implantação',
      texto: 'O roteiro dos módulos contratados vira uma lista de itens com responsável e situação, acompanhada em tela.',
    },
    {
      titulo: 'Cadastro do cliente pelo SICLA',
      texto: 'O processo começa pela consulta ao cliente no SICLA — sem redigitar o que a Rech já tem.',
    },
    {
      titulo: 'Mapa do setor',
      texto: 'Papéis, fases e convenções da implantação em uma árvore, para quem está chegando ao time.',
    },
    {
      titulo: 'Busca de cliente sempre à mão',
      texto: 'A barra do topo encontra o cliente de qualquer tela, sem voltar ao começo.',
    },
    {
      titulo: 'Funciona no navegador',
      texto: 'Nada para instalar: abre no computador da Rech pelo endereço interno do Painel.',
    },
  ];
}
