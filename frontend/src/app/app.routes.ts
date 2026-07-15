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
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'projetos',
        loadComponent: () =>
          import('./features/projetos/projetos-lista.component').then((m) => m.ProjetosListaComponent),
      },
      {
        path: 'projetos/novo',
        loadComponent: () =>
          import('./features/projetos/projeto-form.component').then((m) => m.ProjetoFormComponent),
      },
      {
        path: 'projetos/:id',
        loadComponent: () =>
          import('./features/projetos/projeto-form.component').then((m) => m.ProjetoFormComponent),
      },
      {
        path: 'projetos/:id/agenda',
        loadComponent: () => import('./features/agenda/agenda.component').then((m) => m.AgendaComponent),
      },
      {
        path: 'projetos/:id/designacao/definir-gci',
        canActivate: [perfilGuard('ADM', 'Administrativo')],
        loadComponent: () =>
          import('./features/designacao/definir-gci.component').then((m) => m.DefinirGciComponent),
      },
      {
        path: 'projetos/:id/designacao/agendar',
        canActivate: [perfilGuard('ADM', 'Administrativo')],
        loadComponent: () =>
          import('./features/designacao/agendar-levantamento.component').then(
            (m) => m.AgendarLevantamentoComponent,
          ),
      },
      {
        path: 'projetos/:id/designacao/consultores',
        canActivate: [perfilGuard('ADM', 'GCI')],
        loadComponent: () =>
          import('./features/designacao/designar-consultores.component').then(
            (m) => m.DesignarConsultoresComponent,
          ),
      },
      {
        path: 'projetos/:id/documentos',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        loadComponent: () =>
          import('./features/documentos/documentos-projeto.component').then(
            (m) => m.DocumentosProjetoComponent,
          ),
      },
      {
        path: 'projetos/:id/cronograma',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'Consultor')],
        loadComponent: () =>
          import('./features/plano-cronograma/cronograma-plano.component').then(
            (m) => m.CronogramaPlanoComponent,
          ),
      },
      {
        path: 'projetos/:id/checklist',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'Consultor')],
        loadComponent: () =>
          import('./features/plano-cronograma/checklist-plano.component').then(
            (m) => m.ChecklistPlanoComponent,
          ),
      },
      {
        path: 'coordenacao',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        loadComponent: () =>
          import('./features/coordenacao/coordenacao.component').then((m) => m.CoordenacaoComponent),
      },
      {
        path: 'coordenacao/capacidade',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        loadComponent: () =>
          import('./features/coordenacao/capacidade.component').then((m) => m.CapacidadeComponent),
      },
      {
        path: 'atividade',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        loadComponent: () =>
          import('./features/atividade/atividade.component').then((m) => m.AtividadeComponent),
      },
      {
        path: 'monitoramento',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        loadComponent: () =>
          import('./features/monitoramento/monitoramento.component').then((m) => m.MonitoramentoComponent),
      },
      {
        path: 'matriz',
        loadComponent: () =>
          import('./features/matriz/matriz-lista.component').then((m) => m.MatrizListaComponent),
      },
      {
        path: 'matriz/:id',
        loadComponent: () =>
          import('./features/matriz/matriz-ficha.component').then((m) => m.MatrizFichaComponent),
      },
      {
        path: 'config/disponibilidade',
        canActivate: [perfilGuard('ADM')],
        loadComponent: () =>
          import('./features/config/config-disponibilidade.component').then(
            (m) => m.ConfigDisponibilidadeComponent,
          ),
      },
      {
        path: 'config/consultas-bd',
        canActivate: [perfilGuard('ADM')],
        loadComponent: () =>
          import('./features/config/consultas-bd-lista.component').then((m) => m.ConsultasBdListaComponent),
      },
      {
        path: 'config/consultas-bd/novo',
        canActivate: [perfilGuard('ADM')],
        loadComponent: () =>
          import('./features/config/consulta-bd-form.component').then((m) => m.ConsultaBdFormComponent),
      },
      {
        path: 'config/consultas-bd/:slug',
        canActivate: [perfilGuard('ADM')],
        loadComponent: () =>
          import('./features/config/consulta-bd-form.component').then((m) => m.ConsultaBdFormComponent),
      },
      {
        path: 'dashboards',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        loadComponent: () =>
          import('./features/dashboards/dashboards-lista.component').then((m) => m.DashboardsListaComponent),
      },
      {
        path: 'dashboards/:slug',
        canActivate: [perfilGuard('ADM', 'Coordenador', 'Administrativo', 'GCI')],
        loadComponent: () =>
          import('./features/dashboards/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'usuarios',
        canActivate: [perfilGuard('ADM')],
        loadComponent: () =>
          import('./features/usuarios/usuarios-lista.component').then((m) => m.UsuariosListaComponent),
      },
      {
        path: 'usuarios/novo',
        canActivate: [perfilGuard('ADM')],
        loadComponent: () =>
          import('./features/usuarios/usuario-form.component').then((m) => m.UsuarioFormComponent),
      },
      {
        path: 'usuarios/:id',
        canActivate: [perfilGuard('ADM')],
        loadComponent: () =>
          import('./features/usuarios/usuario-form.component').then((m) => m.UsuarioFormComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
