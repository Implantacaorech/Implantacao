import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { recarregarSeBuildTrocou } from './core/utils/build-desatualizado';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Qualquer navegação para uma rota preguiçosa pode esbarrar num chunk que sumiu no
      // último `ng build` — não só o login. Aqui a aba se recupera sozinha, recarregando
      // uma vez; sem isto o clique no menu simplesmente não faz nada
      // (ver core/utils/build-desatualizado.ts).
      withNavigationErrorHandler((erro) => {
        recarregarSeBuildTrocou(erro.error);
      }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
