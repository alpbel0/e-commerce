import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import type { ApiErrorResponse } from '../models/common.models';
import { ToastService } from '../notify/toast.service';

function isPublicAuthUrl(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password')
  );
}

function extractMessage(err: HttpErrorResponse): string {
  const body = err.error as ApiErrorResponse | undefined;
  if (body && typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }
  return err.message || 'İstek başarısız oldu.';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      if (err.status === 401) {
        if (isPublicAuthUrl(req.url)) {
          return throwError(() => err);
        }
        if (req.url.includes('/auth/refresh')) {
          authStore.logout();
          void router.navigate(['/auth/login']);
          return throwError(() => err);
        }
        const rt = localStorage.getItem('refresh_token');
        if (!rt) {
          authStore.logout();
          void router.navigate(['/auth/login']);
          return throwError(() => err);
        }
        return authStore.refreshAccessToken().pipe(
          switchMap((token) =>
            next(
              req.clone({
                setHeaders: { Authorization: `Bearer ${token}` }
              })
            )
          ),
          catchError(() => {
            authStore.logout();
            void router.navigate(['/auth/login']);
            return throwError(() => err);
          })
        );
      }

      if (err.status === 403) {
        window.dispatchEvent(
          new CustomEvent('app:access-denied', {
            detail: { message: extractMessage(err) }
          })
        );
        toast.showError('Bu işlem için yetkiniz yok.');
        return throwError(() => err);
      }

      if (err.status >= 400) {
        toast.showError(extractMessage(err));
      }

      return throwError(() => err);
    })
  );
};
