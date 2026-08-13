import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { perfilGuard } from './core/guards/perfil.guard';
import { permissaoGuard } from './core/guards/permissao.guard';
import { LoginComponent } from './features/login/login.component';
import { ShellComponent } from './layouts/shell/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    // "Esqueci minha senha" — junto do login, é a outra tela que roda FORA do shell (sem
    // menu/topbar) e sem autenticação, por definição: quem chega aqui não consegue entrar.
    path: 'esqueci-senha',
    loadComponent: () =>
      import('./features/esqueci-senha/esqueci-senha.component').then((m) => m.EsqueciSenhaComponent),
  },
  {
    // Apresentação dos recursos do Painel — página PÚBLICA (sem authGuard), linkada por um
    // botão no cartão de login: existe justamente para quem ainda não entrou.
    path: 'apresentacao',
    loadComponent: () =>
      import('./features/apresentacao/apresentacao.component').then((m) => m.ApresentacaoComponent),
  },
  {
    // Auto-cadastro: continua registrado, mas SEM porta de entrada no login desde
    // 2026-07-30 (o "Criar conta" saiu do cartão de acesso a pedido do usuário). Quem
    // precisa de acesso é cadastrado pelo ADM em Gestão → Usuários.
    path: 'cadastro',
    loadComponent: () => import('./features/cadastro/cadastro.component').then((m) => m.CadastroComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        data: { titulo: 'Visão Geral' },
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'projetos',
        canActivate: [permissaoGuard('carteira')],
        data: { titulo: 'Carteira de Projetos' },
        loadComponent: () =>
          import('./features/projetos/projetos-lista.component').then((m) => m.ProjetosListaComponent),
      },
      {
        // ENTRADA do processo (passo 1): o Comercial consulta o cliente no SICLA e cadastra
        // a ficha. Substitui a antiga leitura automática de e-mail. Perfis internos também
        // alcançam (podem iniciar por aqui); o backend decide quem realmente cadastra.
        path: 'clientes/novo',
        canActivate: [permissaoGuard('novo_cliente')],
        data: { titulo: 'Consulta e Cadastro do Cliente' },
        loadComponent: () =>
          import('./features/clientes-sicla/consulta-cliente.component').then(
            (m) => m.ConsultaClienteComponent,
          ),
      },
      {
        path: 'projetos/novo',
        data: { titulo: 'Novo projeto' },
        loadComponent: () =>
          import('./features/projetos/projeto-form.component').then((m) => m.ProjetoFormComponent),
      },
      {
        // O FLUXO é a entrada do projeto: abrir um projeto cai direto nos passos, num lugar
        // só. Antes aqui ficava a ficha (projeto-form) com um stepper próprio que competia
        // com os passos — era o "fluxo espaçado" que o usuário reportou (2026-07-24).
        path: 'projetos/:id',
        canActivate: [permissaoGuard('carteira')],
        data: { titulo: 'Projeto' },
        loadComponent: () =>
          import('./features/passos/passos.component').then((m) => m.PassosComponent),
      },
      {
        // A ficha vira o EDITOR de dados do cliente, alcançado a partir do fluxo — não é
        // mais a página principal do projeto.
        path: 'projetos/:id/dados',
        data: { titulo: 'Dados do cliente' },
        loadComponent: () =>
          import('./features/projetos/projeto-form.component').then((m) => m.ProjetoFormComponent),
      },
      {
        path: 'projetos/:id/levantamento',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI', 'Levantador')],
        data: { titulo: 'Levantamento' },
        loadComponent: () =>
          import('./features/levantamento/levantamento.component').then((m) => m.LevantamentoComponent),
      },
      {
        path: 'projetos/:id/editar/:doc',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        data: { titulo: 'Edição estruturada' },
        loadComponent: () => import('./features/doc-editar/doc-editar.component').then((m) => m.DocEditarComponent),
      },
      {
        path: 'projetos/:id/projeto/origem',
        data: { titulo: 'Gerar Projeto' },
        loadComponent: () =>
          import('./features/projeto-origem/projeto-origem.component').then((m) => m.ProjetoOrigemComponent),
      },
      {
        path: 'projetos/:id/documentos/:docId/ver',
        data: { titulo: 'Pré-visualização' },
        loadComponent: () =>
          import('./features/projetos/doc-preview.component').then((m) => m.DocPreviewComponent),
      },
      {
        path: 'projetos/:id/email',
        data: { titulo: 'Enviar E-mail' },
        loadComponent: () =>
          import('./features/projeto-email/projeto-email.component').then((m) => m.ProjetoEmailComponent),
      },
      {
        path: 'projetos/:id/agenda',
        data: { titulo: 'Agenda de Visitas' },
        loadComponent: () => import('./features/agenda/agenda.component').then((m) => m.AgendaComponent),
      },
      {
        path: 'projetos/:id/agenda/acompanhamento',
        data: { titulo: 'Acompanhamento' },
        loadComponent: () =>
          import('./features/agenda/agenda-acompanhamento.component').then(
            (m) => m.AgendaAcompanhamentoComponent,
          ),
      },
      // As 3 telas de Designação (definir-gci, agendar, consultores) foram DESATIVADAS em
      // 2026-07-24: a função delas vive inteira nos formulários dos passos 2 e 6. Os
      // componentes e o DesignacaoService seguem no repositório (o serviço é reaproveitado
      // pelos passos); só não há mais porta de entrada dupla. Reativar é repor as rotas.
      {
        // Sem perfilGuard: todo autenticado VÊ os 18 passos; quem pode CONCLUIR cada um é
        // decidido pelo backend, passo a passo (ver PERFIS_POR_RESPONSAVEL).
        path: 'projetos/:id/passos',
        data: { titulo: 'Passos do processo' },
        loadComponent: () =>
          import('./features/passos/passos.component').then(
            (m) => m.PassosComponent,
          ),
      },
      {
        path: 'projetos/:id/cronograma',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'Consultor')],
        data: { titulo: 'Cronograma' },
        loadComponent: () =>
          import('./features/plano-cronograma/cronograma-plano.component').then(
            (m) => m.CronogramaPlanoComponent,
          ),
      },
      {
        path: 'projetos/:id/checklist',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'Consultor')],
        data: { titulo: 'Check-list' },
        loadComponent: () =>
          import('./features/plano-cronograma/checklist-plano.component').then(
            (m) => m.ChecklistPlanoComponent,
          ),
      },
      {
        path: 'coordenacao',
        canActivate: [permissaoGuard('coordenacao')],
        data: { titulo: 'Painel de Coordenação' },
        loadComponent: () =>
          import('./features/coordenacao/coordenacao.component').then((m) => m.CoordenacaoComponent),
      },
      {
        path: 'coordenacao/capacidade',
        canActivate: [permissaoGuard('coordenacao')],
        data: { titulo: 'Capacidade da equipe' },
        loadComponent: () =>
          import('./features/coordenacao/capacidade.component').then((m) => m.CapacidadeComponent),
      },
      {
        path: 'atividade',
        canActivate: [permissaoGuard('atividade')],
        data: { titulo: 'Atividade' },
        loadComponent: () =>
          import('./features/atividade/atividade.component').then((m) => m.AtividadeComponent),
      },
      {
        path: 'monitoramento',
        canActivate: [permissaoGuard('centro_operacional')],
        data: { titulo: 'Centro de Monitoramento' },
        loadComponent: () =>
          import('./features/monitoramento/monitoramento.component').then((m) => m.MonitoramentoComponent),
      },
      {
        path: 'protocolos',
        canActivate: [permissaoGuard('protocolos')],
        data: { titulo: 'Transcrição Áudio/Vídeo' },
        loadComponent: () => import('./features/protocolos/protocolos.component').then((m) => m.ProtocolosComponent),
      },
      {
        // Precisa vir ANTES de 'protocolos/:id' — senão 'gravar' seria lido como um id.
        path: 'protocolos/gravar',
        canActivate: [permissaoGuard('protocolos')],
        data: { titulo: 'Gravar reunião' },
        loadComponent: () => import('./features/protocolos/gravacao.component').then((m) => m.GravacaoComponent),
      },
      {
        path: 'dicionario',
        canActivate: [permissaoGuard('dicionario')],
        data: { titulo: 'Dicionário Inteligente' },
        loadComponent: () =>
          import('./features/dicionario/dicionario.component').then((m) => m.DicionarioComponent),
      },
      {
        path: 'dicionario/:slug',
        canActivate: [permissaoGuard('dicionario')],
        data: { titulo: 'Documento — Dicionário Inteligente' },
        loadComponent: () =>
          import('./features/dicionario/dicionario-documento.component').then((m) => m.DicionarioDocumentoComponent),
      },
      {
        path: 'protocolos/:id',
        canActivate: [permissaoGuard('protocolos')],
        data: { titulo: 'Transcrição Áudio/Vídeo — revisão' },
        loadComponent: () =>
          import('./features/protocolos/protocolo-ficha.component').then((m) => m.ProtocoloFichaComponent),
      },
      {
        path: 'matriz',
        canActivate: [permissaoGuard('matriz')],
        data: { titulo: 'Matriz de Conhecimento' },
        loadComponent: () =>
          import('./features/matriz/matriz-lista.component').then((m) => m.MatrizListaComponent),
      },
      {
        path: 'matriz/:id',
        canActivate: [permissaoGuard('matriz')],
        data: { titulo: 'Matriz' },
        loadComponent: () =>
          import('./features/matriz/matriz-ficha.component').then((m) => m.MatrizFichaComponent),
      },
      {
        path: 'matriz-detalhada',
        canActivate: [permissaoGuard('matriz_detalhada')],
        data: { titulo: 'Matriz por Menu (SIGER)' },
        loadComponent: () =>
          import('./features/matriz/matriz-detalhada.component').then((m) => m.MatrizDetalhadaComponent),
      },
      {
        path: 'matriz-funcoes',
        canActivate: [permissaoGuard('matriz_funcoes')],
        data: { titulo: 'Matriz por Menu - Funções SICLA' },
        loadComponent: () =>
          import('./features/matriz/matriz-funcoes.component').then((m) => m.MatrizFuncoesComponent),
      },
      {
        path: 'config/disponibilidade',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Disponibilidade dos Consultores' },
        loadComponent: () =>
          import('./features/config/config-disponibilidade.component').then(
            (m) => m.ConfigDisponibilidadeComponent,
          ),
      },
      {
        path: 'config/email',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Config — E-mail' },
        loadComponent: () =>
          import('./features/config/config-email.component').then((m) => m.ConfigEmailComponent),
      },
      {
        path: 'config/imap',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Config — Caixa de entrada' },
        loadComponent: () =>
          import('./features/config/config-imap.component').then((m) => m.ConfigImapComponent),
      },
      {
        path: 'config/gmail',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Config — Gmail API' },
        loadComponent: () =>
          import('./features/config/config-gmail.component').then((m) => m.ConfigGmailComponent),
      },
      {
        path: 'config/ia',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Modo IA' },
        loadComponent: () =>
          import('./features/config/config-ia.component').then((m) => m.ConfigIaComponent),
      },
      {
        path: 'cadastros',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Cadastros' },
        loadComponent: () => import('./features/cadastros/cadastros.component').then((m) => m.CadastrosComponent),
      },
      {
        path: 'cadastros/:aba',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Cadastros' },
        loadComponent: () => import('./features/cadastros/cadastros.component').then((m) => m.CadastrosComponent),
      },
      {
        path: 'config/modelos-email',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Modelos de E-mail' },
        loadComponent: () =>
          import('./features/config/modelos-email.component').then((m) => m.ModelosEmailComponent),
      },
      {
        path: 'config/modelos-email/:id',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Modelo de E-mail' },
        loadComponent: () =>
          import('./features/config/modelo-email-form.component').then((m) => m.ModeloEmailFormComponent),
      },
      {
        path: 'config/destinatarios-passo',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Destinatários por Passo' },
        loadComponent: () =>
          import('./features/config/destinatarios-passo.component').then(
            (m) => m.DestinatariosPassoComponent,
          ),
      },
      {
        path: 'config/consultas-bd',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Consultas BD' },
        loadComponent: () =>
          import('./features/config/consultas-bd.component').then((m) => m.ConsultasBdComponent),
      },
      {
        path: 'config/consultas-bd/:slug',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Consultas BD' },
        loadComponent: () =>
          import('./features/config/consultas-bd.component').then((m) => m.ConsultasBdComponent),
      },
      // ── Área BI ─────────────────────────────────────────────────────────────────
      // Uma entrada só no menu ("BI"), com duas abas de 1º nível — cada uma um BI — e
      // subabas dentro delas. O RBAC continua separado: `dashboards` libera o BI
      // Implantação; `bi_implantacao`, o Implantação Clientes SIGER.
      { path: 'bi', pathMatch: 'full', redirectTo: 'bi/implantacao' },
      {
        path: 'bi/implantacao',
        canActivate: [permissaoGuard('dashboards')],
        data: { titulo: 'BI Implantação' },
        loadComponent: () =>
          import('./features/dashboards/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        // O dashboard por slug ganhou o prefixo `painel/` para não colidir com as subabas
        // fixas de Indicadores (contratacao/conclusao/utilizacao).
        path: 'bi/implantacao/painel/:slug',
        canActivate: [permissaoGuard('dashboards')],
        data: { titulo: 'BI Implantação' },
        loadComponent: () =>
          import('./features/dashboards/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        // Indicadores portados do BI_Interno.pbix — as três saem da mesma view.
        path: 'bi/implantacao/contratacao',
        canActivate: [permissaoGuard('dashboards')],
        data: { titulo: 'BI — Indicadores de Contratação' },
        loadComponent: () =>
          import('./features/bi-indicadores/bi-contratacao.component').then(
            (m) => m.BiContratacaoComponent,
          ),
      },
      {
        path: 'bi/implantacao/conclusao',
        canActivate: [permissaoGuard('dashboards')],
        data: { titulo: 'BI — Indicadores de Conclusão' },
        loadComponent: () =>
          import('./features/bi-indicadores/bi-conclusao.component').then(
            (m) => m.BiConclusaoComponent,
          ),
      },
      {
        path: 'bi/implantacao/utilizacao',
        canActivate: [permissaoGuard('dashboards')],
        data: { titulo: 'BI — % de Utilização das Horas' },
        loadComponent: () =>
          import('./features/bi-indicadores/bi-utilizacao.component').then(
            (m) => m.BiUtilizacaoComponent,
          ),
      },
      {
        path: 'bi/implantacao/alocacao-calendario',
        canActivate: [permissaoGuard('dashboards')],
        data: { titulo: 'BI — Alocação de Agendas (Calendário)' },
        loadComponent: () =>
          import('./features/bi-indicadores/bi-alocacao-calendario.component').then(
            (m) => m.BiAlocacaoCalendarioComponent,
          ),
      },
      {
        path: 'bi/implantacao/alocacao-horas',
        canActivate: [permissaoGuard('dashboards')],
        data: { titulo: 'BI — Alocação de Agendas (Horas Aplicadas)' },
        loadComponent: () =>
          import('./features/bi-indicadores/bi-alocacao-horas.component').then(
            (m) => m.BiAlocacaoHorasComponent,
          ),
      },
      {
        path: 'bi/implantacao/movimentos',
        canActivate: [permissaoGuard('dashboards')],
        data: { titulo: 'BI — Movimentos de trabalho efetivo' },
        loadComponent: () =>
          import('./features/bi-indicadores/bi-movimentos.component').then(
            (m) => m.BiMovimentosComponent,
          ),
      },
      {
        path: 'bi/clientes-siger',
        pathMatch: 'full',
        redirectTo: 'bi/clientes-siger/resumo',
      },
      {
        // Porte das 4 páginas do BI_clientes.pbix (Power BI), lendo as views do schema
        // POWERBI do SICLA pela conexão Oracle da Disponibilidade.
        path: 'bi/clientes-siger/resumo',
        canActivate: [permissaoGuard('bi_implantacao')],
        data: { titulo: 'BI — Resumo de Implantação' },
        loadComponent: () =>
          import('./features/bi-implantacao/bi-implantacao.component').then(
            (m) => m.BiImplantacaoComponent,
          ),
      },
      {
        path: 'bi/clientes-siger/extrato',
        canActivate: [permissaoGuard('bi_implantacao')],
        data: { titulo: 'BI — Extrato de Protocolo/Horas' },
        loadComponent: () =>
          import('./features/bi-implantacao/bi-extrato.component').then(
            (m) => m.BiExtratoComponent,
          ),
      },
      {
        path: 'bi/clientes-siger/rns',
        canActivate: [permissaoGuard('bi_implantacao')],
        data: { titulo: 'BI — RNS vinculadas' },
        loadComponent: () =>
          import('./features/bi-implantacao/bi-rns.component').then((m) => m.BiRnsComponent),
      },
      {
        path: 'bi/clientes-siger/agendas',
        canActivate: [permissaoGuard('bi_implantacao')],
        data: { titulo: 'BI — Agendas' },
        loadComponent: () =>
          import('./features/bi-implantacao/bi-agendas.component').then(
            (m) => m.BiAgendasComponent,
          ),
      },
      // Endereços antigos — mantidos como redirect para não quebrar link salvo/favorito.
      { path: 'dashboards', pathMatch: 'full', redirectTo: 'bi/implantacao' },
      { path: 'dashboards/:slug', redirectTo: 'bi/implantacao/painel/:slug' },
      { path: 'bi-implantacao', pathMatch: 'full', redirectTo: 'bi/clientes-siger/resumo' },
      { path: 'bi-implantacao/extrato', redirectTo: 'bi/clientes-siger/extrato' },
      { path: 'bi-implantacao/rns', redirectTo: 'bi/clientes-siger/rns' },
      { path: 'bi-implantacao/agendas', redirectTo: 'bi/clientes-siger/agendas' },
      {
        // Hub das telas de configuração — era a seção "Configurações e saúde" da Visão
        // Geral (movida para cá em 2026-07-28). Gate pelo menu `ferramentas` (fixo-ADM).
        path: 'ferramentas',
        canActivate: [permissaoGuard('ferramentas')],
        data: { titulo: 'Ferramentas' },
        loadComponent: () =>
          import('./features/ferramentas/ferramentas.component').then(
            (m) => m.FerramentasComponent,
          ),
      },
      {
        // Sistema → Prontidão do Sistema: Auditoria de Prontidão dos 9 eixos (fixo-ADM).
        path: 'prontidao',
        canActivate: [permissaoGuard('prontidao')],
        data: { titulo: 'Prontidão do Sistema' },
        loadComponent: () =>
          import('./features/prontidao/prontidao.component').then(
            (m) => m.ProntidaoComponent,
          ),
      },
      {
        path: 'permissoes',
        canActivate: [permissaoGuard('permissoes')],
        data: { titulo: 'Permissões' },
        loadComponent: () =>
          import('./features/permissoes/permissoes.component').then((m) => m.PermissoesComponent),
      },
      {
        path: 'fluxo',
        data: { titulo: 'Fluxo automático' },
        loadComponent: () => import('./features/fluxo/fluxo-inicio.component').then((m) => m.FluxoInicioComponent),
      },
      {
        path: 'fluxo/confirmar',
        data: { titulo: 'Confirmar fluxo' },
        loadComponent: () =>
          import('./features/fluxo/fluxo-confirmar.component').then((m) => m.FluxoConfirmarComponent),
      },
      {
        path: 'perfil',
        data: { titulo: 'Meu perfil' },
        loadComponent: () => import('./features/perfil/perfil.component').then((m) => m.PerfilComponent),
      },
      {
        path: 'mapa',
        data: { titulo: 'Mapa do Setor' },
        loadComponent: () => import('./features/mapa/mapa.component').then((m) => m.MapaComponent),
      },
      {
        path: 'trocar-senha',
        data: { titulo: 'Trocar senha' },
        loadComponent: () =>
          import('./features/trocar-senha/trocar-senha.component').then((m) => m.TrocarSenhaComponent),
      },
      {
        path: 'legado',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Assistente de Geradores (legado)' },
        loadComponent: () => import('./features/legado/legado-index.component').then((m) => m.LegadoIndexComponent),
      },
      {
        path: 'legado/cliente',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Dados do Cliente' },
        loadComponent: () => import('./features/legado/cliente.component').then((m) => m.ClienteComponent),
      },
      {
        path: 'legado/:rid',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Papel' },
        loadComponent: () => import('./features/legado/role.component').then((m) => m.LegadoRoleComponent),
      },
      {
        path: 'legado/:rid/saude',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Saúde do Sistema' },
        loadComponent: () => import('./features/legado/saude.component').then((m) => m.SaudeComponent),
      },
      {
        path: 'legado/:rid/criar-templates',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Criação dos Templates' },
        loadComponent: () =>
          import('./features/legado/criar-templates.component').then((m) => m.CriarTemplatesComponent),
      },
      {
        path: 'legado/:rid/verbal',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Tempo Verbal e Ortografia' },
        loadComponent: () => import('./features/legado/verbal.component').then((m) => m.VerbalComponent),
      },
      {
        path: 'legado/:rid/modulos/:aid',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Seleção de Módulos' },
        loadComponent: () =>
          import('./features/legado/selecao-modulos.component').then((m) => m.SelecaoModulosComponent),
      },
      {
        path: 'legado/:rid/importar/:aid',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Importar Levantamento' },
        loadComponent: () => import('./features/legado/importar.component').then((m) => m.ImportarComponent),
      },
      {
        path: 'legado/:rid/gerar/:aid',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Gerar documento' },
        loadComponent: () => import('./features/legado/gerar.component').then((m) => m.GerarComponent),
      },
      {
        path: 'usuarios',
        canActivate: [perfilGuard('ADM')],
        data: { titulo: 'Usuários' },
        loadComponent: () => import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
