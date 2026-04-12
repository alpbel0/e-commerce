import type { RoleType } from '../models/common.models';

/** Roadmap: login sonrası rol bazlı hedefler */
export function homeCommandsForRole(role: RoleType | null): string[] {
  switch (role) {
    case 'ADMIN':
      return ['/admin', 'dashboard'];
    case 'CORPORATE':
      return ['/corporate', 'dashboard'];
    case 'INDIVIDUAL':
      return ['/app', 'products'];
    default:
      return ['/auth', 'login'];
  }
}
