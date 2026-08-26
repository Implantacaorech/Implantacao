import { bootstrapApplication } from '@angular/platform-browser';
import { appConfigDe } from './app/app.config';
import { App } from './app/app';
import { carregarInstancia } from './app/core/services/instancia.service';

/** Quem serve este front-end — Painel ou **Portal API** — é perguntado ANTES de a aplicação
 * subir, e é isso que decide a TABELA DE ROTAS (ver `app.config.ts`).
 *
 * Resolver depois não bastava: o usuário pediu que o Portal API não *tivesse* os demais
 * módulos, não que os escondesse. Rota que não existe não é alcançável nem digitando o
 * endereço, e o chunk dela nem é baixado.
 *
 * `carregarInstancia` nunca lança: sem resposta, vale o Painel completo. */
void carregarInstancia().then((instancia) =>
  bootstrapApplication(App, appConfigDe(instancia)).catch((err) =>
    console.error(err),
  ),
);
