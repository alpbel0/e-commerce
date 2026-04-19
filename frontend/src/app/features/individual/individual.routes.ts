import { Routes } from '@angular/router';

import { authGuard } from '../../core/auth/guards/auth.guard';
import { roleGuard } from '../../core/auth/guards/role.guard';

const individualOnly = {
  canActivate: [authGuard, roleGuard],
  data: { roles: ['INDIVIDUAL'] }
};

export const individualRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    title: 'Ana Sayfa'
  },
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
    path: 'stores/:slug',
    loadComponent: () =>
      import('./stores/store-public.component').then((m) => m.StorePublicComponent),
    title: 'Magaza'
  },
  {
    path: 'cart',
    ...individualOnly,
    loadComponent: () => import('./cart/cart.component').then((m) => m.CartComponent),
    title: 'Sepet'
  },
  {
    path: 'checkout',
    ...individualOnly,
    loadComponent: () => import('./checkout/checkout.component').then((m) => m.CheckoutComponent),
    title: 'Odeme'
  },
  {
    path: 'orders',
    ...individualOnly,
    loadComponent: () =>
      import('./orders/order-list/order-list.component').then((m) => m.OrderListComponent),
    title: 'Siparisler'
  },
  {
    path: 'orders/:id',
    ...individualOnly,
    loadComponent: () =>
      import('./orders/order-detail/order-detail.component').then((m) => m.OrderDetailComponent),
    title: 'Siparis'
  },
  {
    path: 'orders/:id/shipment',
    ...individualOnly,
    loadComponent: () =>
      import('./orders/shipment-tracking/shipment-tracking.component').then((m) => m.ShipmentTrackingComponent),
    title: 'Kargo Takip'
  },
  {
    path: 'shipments/:shipmentId',
    ...individualOnly,
    loadComponent: () =>
      import('./orders/shipment-tracking/shipment-tracking.component').then((m) => m.ShipmentTrackingComponent),
    title: 'Kargo Detay'
  },
  {
    path: 'profile',
    ...individualOnly,
    loadComponent: () => import('./profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Profil'
  },
  {
    path: 'wishlist',
    ...individualOnly,
    loadComponent: () => import('./wishlist/wishlist.component').then((m) => m.WishlistComponent),
    title: 'Favoriler'
  },
  {
    path: 'chat',
    ...individualOnly,
    loadComponent: () =>
      import('../chat/chat-home.component').then((m) => m.ChatHomeComponent),
    title: 'AI Chat'
  }
];
