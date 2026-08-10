import { existsSync } from 'fs';
import { join, normalize } from 'path';
import type { NextFunction, Request, Response } from 'express';

/** Extensões que o `ng build` emite. Só o que é ARQUIVO de build entra aqui — nada de rota
 * do Angular, que não tem extensão (`/home`, `/projetos/5`) e continua caindo no fallback. */
const EXTENSOES_DE_BUILD =
  /\.(js|mjs|css|map|woff2?|ttf|eot|svg|png|jpe?g|gif|ico|webp|json|txt)$/i;

/** Devolve 404 quando um ARQUIVO de build pedido não existe mais no disco, em vez de deixar
 * o fallback de SPA responder `index.html`.
 *
 * Por que isto existe (incidente de 2026-08-03, "os logins não funcionam"): o `ng build`
 * apaga os chunks antigos e gera nomes novos com hash. A aba que já estava aberta antes de
 * um rebuild continua com o `main-*.js` velho em memória e, ao navegar para uma rota
 * preguiçosa (`loadComponent: () => import(...)`), pede um `chunk-*.js` que não existe mais.
 * Sem esta guarda o servidor respondia **200 com `text/html`** (o index.html do fallback);
 * o navegador recusa o módulo por MIME type, o `import()` REJEITA, a navegação do router
 * rejeita junto — e, no login, o `catch` da tela traduzia isso em "Verifique login e senha".
 * O usuário via erro de senha; o backend tinha acabado de emitir o token com sucesso.
 *
 * Com o 404, a falha fica honesta: aparece no Network como 404 e o frontend consegue
 * distinguir "build trocou debaixo da aba" de qualquer outro erro (ver
 * frontend/src/app/core/utils/build-desatualizado.ts). */
export function assetsEstaticos(distPath: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    // `req.path` já vem sem query string; corta a barra inicial para resolver dentro do dist.
    const caminho = req.path;
    if (caminho.startsWith('/api/') || !EXTENSOES_DE_BUILD.test(caminho)) {
      return next();
    }

    // `normalize` + prefixo confinam a resolução ao dist — um `..` no caminho não escapa.
    const alvo = normalize(join(distPath, caminho));
    if (!alvo.startsWith(normalize(distPath))) {
      res.sendStatus(404);
      return;
    }
    if (existsSync(alvo)) return next(); // existe: o serve-static entrega normalmente

    res.status(404).type('text/plain').send('Arquivo de build não encontrado.');
  };
}
