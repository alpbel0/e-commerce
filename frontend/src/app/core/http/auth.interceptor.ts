import { HttpInterceptorFn } from '@angular/common/http';

const AUTH_SKIP_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password'
];

function isPublicAuthUrl(url: string): boolean {
  return AUTH_SKIP_PATHS.some((p) => url.includes(p));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isPublicAuthUrl(req.url)) {
    return next(req);
  }
  const token = localStorage.getItem('access_token');
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    })
  );
};
