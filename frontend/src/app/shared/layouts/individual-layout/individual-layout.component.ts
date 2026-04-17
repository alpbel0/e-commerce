import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CartService } from '../../../core/api/cart.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { SidebarComponent, type AppSidebarLink } from '../../components/sidebar/sidebar.component';

@Component({
  selector: 'app-individual-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="app-shell">
      <app-navbar
        layout="individual"
        homeLink="/app/home"
        [cartCount]="cartCount()"
        profileLink="/app/profile"
        ordersLink="/app/orders"
      />
      <div class="app-body">
        <app-sidebar [links]="links" />
        <main class="app-main">
          <div class="app-content animate-fade-in-up">
            <router-outlet />
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .app-body {
      display: flex;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }
    .app-main {
      flex: 1;
      overflow-y: auto;
      background: var(--surface-bg);
    }
    .app-content {
      padding: 28px 32px;
      max-width: 1400px;
    }
    @media (max-width: 768px) {
      .app-content { padding: 20px 16px; }
    }
  `]
})
export class IndividualLayoutComponent implements OnInit {
  private readonly cart = inject(CartService);
  private readonly authStore = inject(AuthStore);

  readonly cartCount = this.cart.itemCount;

  readonly links: AppSidebarLink[] = [
    { label: 'Ana Sayfa',    routerLink: '/app/home',    exact: true, icon: 'heroHome' },
    { label: 'Ürünler',      routerLink: '/app/products',              icon: 'heroCube' },
    { label: 'Siparişlerim', routerLink: '/app/orders',               icon: 'heroShoppingBag' },
    { label: 'Favorilerim',  routerLink: '/app/wishlist',              icon: 'heroHeart' },
    { label: 'Profilim',     routerLink: '/app/profile',              icon: 'heroUser' },
    { label: 'AI Chat',      routerLink: '/chat',                      icon: 'heroChatBubbleLeftEllipsis' }
  ];

  ngOnInit(): void {
    if (!this.authStore.isLoggedIn()) {
      this.cart.clearCount();
      return;
    }
    this.cart.getMyCart().subscribe({
      next: () => {},
      error: () => this.cart.clearCount()
    });
  }
}
