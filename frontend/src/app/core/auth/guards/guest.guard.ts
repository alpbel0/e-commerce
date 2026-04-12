import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { homeCommandsForRole } from '../home-navigation';
import { AuthStore } from '../auth.store';

export const guestGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (!store.isLoggedIn()) {
    return true;
  }

  const role = store.activeRole();
  if (role) {
    return router.createUrlTree(homeCommandsForRole(role));
  }

  return store.ensureProfileLoaded().pipe(
    map(() => {
      const r = store.activeRole();
      if (r) {
        return router.createUrlTree(homeCommandsForRole(r));
      }
      return router.createUrlTree(['/auth', 'login']);
    }),
    catchError(() => of(router.createUrlTree(['/auth', 'login'])))
  );
};
