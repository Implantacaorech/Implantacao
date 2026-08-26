import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withNavigationErrorHandler } from '@angular/router';

import { rotasDe } from './app.routes';
import { Instancia, INSTANCIA_PADRAO, InstanciaService } from './core/services/instancia.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { recarregarSeBuildTrocou } from './core/utils/build-desatualizado';

/** A configuração depende de QUAL instância está servindo: o Portal API recebe uma tabela de
 * rotas curta, com as três telas que ele existe para ter. Ver `core/services/instancia.service.ts`. */
export function appConfigDe(instancia: Instancia): ApplicationConfig {
  return {
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      // Semeia o serviço com o valor JÁ resolvido no boot — daqui em diante ele é síncrono,
      // e nenhuma tela precisa esperar por ele.
      provide: InstanciaService,
      useFactory: () => {
        const s = new InstanciaService();
        s.definir(instancia);
        return s;
      },
    },
    provideRouter(
      rotasDe(instancia.perfil),
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
}

/** Configuração do Painel completo — usada pelos testes e por quem sobe a app sem resolver
 * a instância antes. */
export const appConfig: ApplicationConfig = appConfigDe(INSTANCIA_PADRAO);
