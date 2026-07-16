import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { perfilGuard } from './core/guards/perfil.guard';
import { LoginComponent } from './features/login/login.component';
import { ShellComponent } from './layouts/shell/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
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
        data: { titulo: 'Carteira de Projetos' },
        loadComponent: () =>
          import('./features/projetos/projetos-lista.component').then((m) => m.ProjetosListaComponent),
      },
      {
        path: 'projetos/novo',
        data: { titulo: 'Novo projeto' },
        loadComponent: () =>
          import('./features/projetos/projeto-form.component').then((m) => m.ProjetoFormComponent),
      },
      {
        path: 'projetos/:id',
        data: { titulo: 'Ficha do projeto' },
        loadComponent: () =>
          import('./features/projetos/projeto-form.component').then((m) => m.ProjetoFormComponent),
      },
      {
        path: 'projetos/:id/levantamento',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
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
      {
        path: 'projetos/:id/designacao/definir-gci',
        canActivate: [perfilGuard('ADM', 'Administrativo')],
        data: { titulo: 'Definir GCI' },
        loadComponent: () =>
          import('./features/designacao/definir-gci.component').then((m) => m.DefinirGciComponent),
      },
      {
        path: 'projetos/:id/designacao/agendar',
        canActivate: [perfilGuard('ADM', 'Administrativo')],
        data: { titulo: 'Data do Levantamento' },
        loadComponent: () =>
          import('./features/designacao/agendar-levantamento.component').then(
            (m) => m.AgendarLevantamentoComponent,
          ),
      },
      {
        path: 'projetos/:id/designacao/consultores',
        canActivate: [perfilGuard('ADM', 'GCI')],
        data: { titulo: 'Designar Consultores' },
        loadComponent: () =>
          import('./features/designacao/designar-consultores.component').then(
            (m) => m.DesignarConsultoresComponent,
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
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        data: { titulo: 'Painel de Coordenação' },
        loadComponent: () =>
          import('./features/coordenacao/coordenacao.component').then((m) => m.CoordenacaoComponent),
      },
      {
        path: 'coordenacao/capacidade',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        data: { titulo: 'Capacidade da equipe' },
        loadComponent: () =>
          import('./features/coordenacao/capacidade.component').then((m) => m.CapacidadeComponent),
      },
      {
        path: 'atividade',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        data: { titulo: 'Atividade' },
        loadComponent: () =>
          import('./features/atividade/atividade.component').then((m) => m.AtividadeComponent),
      },
      {
        path: 'monitoramento',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        data: { titulo: 'Centro de Monitoramento' },
        loadComponent: () =>
          import('./features/monitoramento/monitoramento.component').then((m) => m.MonitoramentoComponent),
      },
      {
        path: 'protocolos',
        data: { titulo: 'Protocolos de Treinamento' },
        loadComponent: () => import('./features/protocolos/protocolos.component').then((m) => m.ProtocolosComponent),
      },
      {
        path: 'protocolos/:id',
        data: { titulo: 'Protocolo' },
        loadComponent: () =>
          import('./features/protocolos/protocolo-ficha.component').then((m) => m.ProtocoloFichaComponent),
      },
      {
        path: 'matriz',
        data: { titulo: 'Matriz de Conhecimento' },
        loadComponent: () =>
          import('./features/matriz/matriz-lista.component').then((m) => m.MatrizListaComponent),
      },
      {
        path: 'matriz/:id',
        data: { titulo: 'Matriz' },
        loadComponent: () =>
          import('./features/matriz/matriz-ficha.component').then((m) => m.MatrizFichaComponent),
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
      {
        path: 'dashboards',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        data: { titulo: 'Dashboards' },
        loadComponent: () =>
          import('./features/dashboards/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'dashboards/:slug',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        data: { titulo: 'Dashboards' },
        loadComponent: () =>
          import('./features/dashboards/dashboard.component').then((m) => m.DashboardComponent),
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
