import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroHome,
  heroCube,
  heroShoppingBag,
  heroHeart,
  heroUser,
  heroChatBubbleLeftEllipsis
} from '@ng-icons/heroicons/outline';

import { CartService } from '../../../core/api/cart.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { NavbarComponent } from '../../components/navbar/navbar.component';

@Component({
  selector: 'app-individual-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NavbarComponent, NgIcon],
  providers: [provideIcons({ heroHome, heroCube, heroShoppingBag, heroHeart, heroUser, heroChatBubbleLeftEllipsis })],
  template: `
    <div class="app-shell">
      <app-navbar
        layout="individual"
        homeLink="/app/home"
        [cartCount]="cartCount()"
        profileLink="/app/profile"
        ordersLink="/app/orders"
      />

      <nav class="topnav" aria-label="Ana menü">
        <div class="topnav__inner">
          <a class="topnav__link" routerLink="/app/home" routerLinkActive="topnav__link--active" [routerLinkActiveOptions]="{exact:true}">
            <ng-icon name="heroHome" size="15" />
            Ana Sayfa
          </a>
          <a class="topnav__link" routerLink="/app/products" routerLinkActive="topnav__link--active">
            <ng-icon name="heroCube" size="15" />
            Ürünler
          </a>
          <a class="topnav__link" routerLink="/app/orders" routerLinkActive="topnav__link--active">
            <ng-icon name="heroShoppingBag" size="15" />
            Siparişlerim
          </a>
          <a class="topnav__link" routerLink="/app/wishlist" routerLinkActive="topnav__link--active">
            <ng-icon name="heroHeart" size="15" />
            Favorilerim
          </a>
          <a class="topnav__link" routerLink="/app/profile" routerLinkActive="topnav__link--active">
            <ng-icon name="heroUser" size="15" />
            Profilim
          </a>
          <a class="topnav__link" routerLink="/app/chat" routerLinkActive="topnav__link--active">
            <ng-icon name="heroChatBubbleLeftEllipsis" size="15" />
            AI Chat
          </a>
        </div>
      </nav>

      <main class="app-main">
        <div class="app-content animate-fade-in-up">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--surface-bg);
    }

    /* ---- Secondary top nav ---- */
    .topnav {
      background: #fff;
      border-bottom: 1px solid var(--border-default);
    }
    .topnav__inner {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 0 24px;
      max-width: 1440px;
      margin: 0 auto;
      height: var(--topnav-h);
    }
    .topnav__link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 14px;
      height: 100%;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      text-decoration: none;
      border-bottom: 2px solid transparent;
      transition: color var(--trans-fast), border-color var(--trans-fast);
      white-space: nowrap;
    }
    .topnav__link:hover {
      color: var(--clr-primary-600);
    }
    .topnav__link--active {
      color: var(--clr-primary-600);
      border-bottom-color: var(--clr-primary-600);
      font-weight: 600;
    }

    /* ---- Main content ---- */
    .app-main {
      flex: 1;
      overflow-y: auto;
    }
    .app-content {
      padding: 28px 24px;
      max-width: 1440px;
      margin: 0 auto;
    }
    @media (max-width: 768px) {
      .topnav__inner { padding: 0 16px; overflow-x: auto; }
      .app-content { padding: 20px 16px; }
    }
  `]
})
export class IndividualLayoutComponent implements OnInit {
  private readonly cart = inject(CartService);
  private readonly authStore = inject(AuthStore);

  readonly cartCount = this.cart.itemCount;

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
