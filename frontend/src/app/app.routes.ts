import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/login/login.component';
import { ShellComponent } from './layouts/shell/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
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
    ],
  },
  { path: '**', redirectTo: '' },
];
