import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthStore } from '../auth.store';

export const roleGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const allowed = route.data['roles'] as string[] | undefined;
  if (!allowed?.length) {
    return true;
  }
  return store.ensureProfileLoaded().pipe(
    map(() => {
      const role = store.activeRole();
      return role && allowed.includes(role) ? true : router.createUrlTree(['/unauthorized']);
    }),
    catchError(() => of(router.createUrlTree(['/auth/login'])))
  );
};
