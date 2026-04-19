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
    path: 'stores/:id',
    loadComponent: () => import('./stores/store-detail.component').then((m) => m.AdminStoreDetailComponent),
    title: 'Magaza Detay'
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('../corporate/orders/corporate-order-list.component').then((m) => m.CorporateOrderListComponent),
    title: 'Siparisler'
  },
  {
    path: 'orders/:id',
    loadComponent: () =>
      import('../corporate/orders/corporate-order-detail.component').then((m) => m.CorporateOrderDetailComponent),
    title: 'Siparis'
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./categories/category-list.component').then((m) => m.AdminCategoryListComponent),
    title: 'Kategoriler'
  },
  {
    path: 'categories/:id',
    loadComponent: () =>
      import('./categories/category-detail.component').then((m) => m.AdminCategoryDetailComponent),
    title: 'Kategori Detay'
  },
  {
    path: 'audit-logs',
    loadComponent: () =>
      import('./audit-logs/audit-log-list.component').then((m) => m.AdminAuditLogListComponent),
    title: 'Audit'
  },
  {
    path: 'audit-logs/:id',
    loadComponent: () =>
      import('./audit-logs/audit-log-detail.component').then((m) => m.AdminAuditLogDetailComponent),
    title: 'Audit Detay'
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./analytics/admin-analytics.component').then((m) => m.AdminAnalyticsComponent),
    title: 'Analizler'
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('../chat/chat-home.component').then((m) => m.ChatHomeComponent),
    title: 'AI Chat'
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
