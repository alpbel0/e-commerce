import { Routes } from '@angular/router';

import { AdminHomeComponent } from './features/admin/admin-home.component';
import { AuthHomeComponent } from './features/auth/auth-home.component';
import { ChatHomeComponent } from './features/chat/chat-home.component';
import { DashboardHomeComponent } from './features/dashboard/dashboard-home.component';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'auth',
    component: AuthHomeComponent,
    title: 'Auth'
  },
  {
    path: 'dashboard',
    component: DashboardHomeComponent,
    title: 'Dashboard'
  },
  {
    path: 'admin',
    component: AdminHomeComponent,
    title: 'Admin'
  },
  {
    path: 'chat',
    component: ChatHomeComponent,
    title: 'Chat'
  }
];

