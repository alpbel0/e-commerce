import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    title: 'Dashboard'
  },
  {
    path: 'users',
    loadComponent: () => import('./users/user-list.component').then((m) => m.AdminUserListComponent),
    title: 'Kullanicilar'
  },
  {
    path: 'stores',
    loadComponent: () => import('./stores/store-list.component').then((m) => m.AdminStoreListComponent),
    title: 'Magazalar'
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./categories/category-list.component').then((m) => m.AdminCategoryListComponent),
    title: 'Kategoriler'
  },
  {
    path: 'audit-logs',
    loadComponent: () =>
      import('./audit-logs/audit-log-list.component').then((m) => m.AdminAuditLogListComponent),
    title: 'Audit'
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./analytics/admin-analytics.component').then((m) => m.AdminAnalyticsComponent),
    title: 'Analizler'
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/system-settings.component').then((m) => m.SystemSettingsComponent),
    title: 'Sistem Ayarlari'
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('../individual/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Profil'
  }
];
