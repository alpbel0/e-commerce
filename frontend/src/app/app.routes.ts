import { Routes } from '@angular/router';

import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { roleGuard } from './core/auth/guards/role.guard';
import { AdminLayoutComponent } from './shared/layouts/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './shared/layouts/auth-layout/auth-layout.component';
import { CorporateLayoutComponent } from './shared/layouts/corporate-layout/corporate-layout.component';
import { IndividualLayoutComponent } from './shared/layouts/individual-layout/individual-layout.component';
import { UnauthorizedComponent } from './features/unauthorized/unauthorized.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },

  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes)
  },

  {
    path: 'app',
    component: IndividualLayoutComponent,
    loadChildren: () => import('./features/individual/individual.routes').then((m) => m.individualRoutes)
  },

  {
    path: 'corporate',
    component: CorporateLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['CORPORATE'] },
    loadChildren: () => import('./features/corporate/corporate.routes').then((m) => m.corporateRoutes)
  },

  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes)
  },

  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () => import('./features/chat/chat-home.component').then((m) => m.ChatHomeComponent),
    title: 'Chat'
  },

  { path: 'unauthorized', component: UnauthorizedComponent, title: 'Yetkisiz' },
  { path: '**', redirectTo: 'auth/login' }
];
