import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthStore } from '../auth.store';

export const roleGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const allowed = route.data['roles'] as string[] | undefined;
  if (!allowed?.length) {
    return true;
  }
  const role = store.activeRole();
  if (!role || !allowed.includes(role)) {
    void router.navigate(['/unauthorized']);
    return false;
  }
  return true;
};
