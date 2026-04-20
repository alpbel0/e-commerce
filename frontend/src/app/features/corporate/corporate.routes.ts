import { Routes } from '@angular/router';

const ph = (title: string) => ({
  loadComponent: () =>
    import('../../shared/pages/phase-placeholder.component').then((m) => m.PhasePlaceholderComponent),
  data: { title }
});

export const corporateRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.CorporateDashboardComponent),
    title: 'Dashboard'
  },
  {
    path: 'products/new',
    loadComponent: () =>
      import('./products/product-form/product-form.component').then((m) => m.ProductFormComponent),
    title: 'Yeni urun'
  },
  {
    path: 'products/:id/edit',
    loadComponent: () =>
      import('./products/product-form/product-form.component').then((m) => m.ProductFormComponent),
    title: 'Urun duzenle'
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./products/product-management-list.component').then((m) => m.ProductManagementListComponent),
    title: 'Urunler'
  },
  {
    path: 'inventory',
    loadComponent: () => import('./inventory/inventory.component').then((m) => m.CorporateInventoryComponent),
    title: 'Envanter'
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('./orders/corporate-order-list.component').then((m) => m.CorporateOrderListComponent),
    title: 'Siparisler'
  },
  {
    path: 'orders/:id',
    loadComponent: () =>
      import('./orders/corporate-order-detail.component').then((m) => m.CorporateOrderDetailComponent),
    title: 'Siparis'
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./reviews/review-management.component').then((m) => m.ReviewManagementComponent),
    title: 'Değerlendirmeler'
  },
  {
    path: 'coupons',
    loadComponent: () => import('./coupons/coupons.component').then((m) => m.CouponsComponent),
    title: 'Kuponlar'
  },
  {
    path: 'store-settings',
    loadComponent: () =>
      import('./store-settings/store-settings.component').then((m) => m.StoreSettingsComponent),
    title: 'Magaza'
  },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics/analytics.component').then((m) => m.CorporateAnalyticsComponent),
    title: 'Analizler'
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('../chat/chat-home.component').then((m) => m.ChatHomeComponent),
    title: 'AI Chat'
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./customers/customer-insights.component').then((m) => m.CustomerInsightsComponent),
    title: 'Musteri Analizi'
  },
  {
    path: 'revenue-drilldown',
    loadComponent: () =>
      import('./revenue/revenue-drilldown.component').then((m) => m.RevenueDrilldownComponent),
    title: 'Gelir Drill-down'
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('../individual/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Profil'
  }
];
