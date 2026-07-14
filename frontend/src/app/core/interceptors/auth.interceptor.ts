import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Anexa o Bearer token em toda chamada à API e tenta renovar uma vez em caso de 401 —
 * a autorização real sempre é validada no backend; isso só evita deslogar por um access
 * token expirado enquanto o refresh token ainda é válido. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
    const token = auth.accessToken;
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      const eh401 = err instanceof HttpErrorResponse && err.status === 401;
      const eraLoginOuRefresh = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
      if (!eh401 || eraLoginOuRefresh) return throwError(() => err);

      return from(auth.renovarToken()).pipe(
        switchMap((novoToken) => next(req.clone({ setHeaders: { Authorization: `Bearer ${novoToken}` } }))),
        catchError((erroRenovacao: unknown) => {
          auth.limparSessao();
          return throwError(() => erroRenovacao);
        }),
      );
    }),
  );
};
