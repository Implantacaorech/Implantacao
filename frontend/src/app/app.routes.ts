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
