import { Routes } from '@angular/router';

const ph = (title: string) => ({
  loadComponent: () =>
    import('../../shared/pages/phase-placeholder.component').then((m) => m.PhasePlaceholderComponent),
  data: { title }
});

export const individualRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'home', ...ph('Ana Sayfa'), title: 'Ana Sayfa' },
  {
    path: 'products',
    loadComponent: () =>
      import('./products/product-list/product-list.component').then((m) => m.ProductListComponent),
    title: 'Urunler'
  },
  {
    path: 'products/:id',
    loadComponent: () =>
      import('./products/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
    title: 'Urun'
  },
  {
    path: 'cart',
    loadComponent: () => import('./cart/cart.component').then((m) => m.CartComponent),
    title: 'Sepet'
  },
  {
    path: 'checkout',
    loadComponent: () => import('./checkout/checkout.component').then((m) => m.CheckoutComponent),
    title: 'Odeme'
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('./orders/order-list/order-list.component').then((m) => m.OrderListComponent),
    title: 'Siparisler'
  },
  {
    path: 'orders/:id',
    loadComponent: () =>
      import('./orders/order-detail/order-detail.component').then((m) => m.OrderDetailComponent),
    title: 'Siparis'
  },
  {
    path: 'orders/:id/shipment',
    loadComponent: () =>
      import('./orders/shipment-tracking/shipment-tracking.component').then((m) => m.ShipmentTrackingComponent),
    title: 'Kargo Takip'
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Profil'
  }
];
