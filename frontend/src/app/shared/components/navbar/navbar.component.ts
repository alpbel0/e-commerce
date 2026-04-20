import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroShoppingCart,
  heroChevronDown,
  heroArrowRightOnRectangle,
  heroUserCircle,
  heroSparkles
} from '@ng-icons/heroicons/outline';

import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';

export type NavbarLayout = 'individual' | 'corporate' | 'admin';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, NotificationPanelComponent, NgIcon],
  providers: [provideIcons({
    heroShoppingCart,
    heroChevronDown,
    heroArrowRightOnRectangle,
    heroUserCircle,
    heroSparkles
  })],
  template: `
    <header class="navbar">
      <div class="navbar__inner">
        <a class="navbar__brand" [routerLink]="homeLink">
          <span class="navbar__brand-icon">
            <ng-icon name="heroSparkles" size="18" />
          </span>
          <span class="navbar__brand-text">E-Commerce</span>
          <span class="navbar__brand-badge" [class]="'badge--' + layout">{{ layoutLabel }}</span>
        </a>

        <div class="navbar__center">
          @if (layout === 'corporate' && storeOptions.length > 0) {
            <label class="store-picker">
              <span class="store-picker__label">Mağaza</span>
              <select
                class="store-picker__select"
                [value]="selectedStoreId ?? ''"
                (change)="onStorePick($event)"
              >
                @for (s of storeOptions; track s.id) {
                  <option [value]="s.id">{{ s.name }}</option>
                }
              </select>
              <ng-icon name="heroChevronDown" size="14" class="store-picker__chevron" />
            </label>
          }
        </div>

        <div class="navbar__end">
          @if (authStore.isLoggedIn()) {
            @if (layout === 'individual') {
              <a class="navbar__action" routerLink="/app/cart" aria-label="Sepet">
                <ng-icon name="heroShoppingCart" size="20" />
                @if (cartCount > 0) {
                  <span class="navbar__badge">{{ cartCount > 99 ? '99+' : cartCount }}</span>
                }
              </a>
            }

            <app-notification-panel [ordersLink]="ordersLink" />

            <div class="navbar__user">
              <button
                id="navbar-user-btn"
                type="button"
                class="navbar__user-btn"
                (click)="menu.set(!menu())"
                [attr.aria-expanded]="menu()"
              >
                <span class="navbar__avatar">{{ userInitials }}</span>
                <span class="navbar__user-email">{{ authStore.currentUser()?.email ?? 'Hesap' }}</span>
                <ng-icon name="heroChevronDown" size="14" class="navbar__chevron" [class.rotated]="menu()" />
              </button>

              @if (menu()) {
                <div class="navbar__dropdown animate-fade-in">
                  <div class="navbar__dropdown-header">
                    <span class="navbar__dropdown-avatar">{{ userInitials }}</span>
                    <div>
                      <p class="navbar__dropdown-name">{{ authStore.currentUser()?.email }}</p>
                      <span class="navbar__dropdown-role">{{ layoutLabel }}</span>
                    </div>
                  </div>
                  <div class="navbar__dropdown-divider"></div>
                  <a class="navbar__dropdown-item" [routerLink]="profileLink" (click)="menu.set(false)">
                    <ng-icon name="heroUserCircle" size="16" />
                    Profil
                  </a>
                  <button type="button" class="navbar__dropdown-item navbar__dropdown-item--danger" (click)="logout()">
                    <ng-icon name="heroArrowRightOnRectangle" size="16" />
                    Çıkış Yap
                  </button>
                </div>
              }
            </div>
          } @else {
            <a class="navbar__login" routerLink="/auth/login">Giriş Yap</a>
            <a class="navbar__register" routerLink="/auth/register">Kayıt Ol</a>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .navbar {
      background: var(--surface-nav);
      border-bottom: 1px solid var(--border-default);
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      position: sticky;
      top: 0;
      z-index: 100;
      height: var(--navbar-h);
      display: flex;
      align-items: center;
    }
    .navbar__inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 24px;
      width: 100%;
      max-width: 1440px;
      margin: 0 auto;
    }
    .navbar__brand {
      display: flex;
      align-items: center;
      gap: 9px;
      text-decoration: none;
      flex-shrink: 0;
    }
    .navbar__brand-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
      border-radius: var(--radius-md);
      color: #fff;
      box-shadow: 0 2px 8px rgba(2,132,199,.35);
    }
    .navbar__brand-text {
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--text-primary);
      letter-spacing: -.02em;
    }
    .navbar__brand-badge {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: var(--radius-full);
    }
    .badge--individual { background: var(--clr-primary-100); color: var(--clr-primary-700); }
    .badge--corporate  { background: #dbeafe; color: #1d4ed8; }
    .badge--admin      { background: #fef3c7; color: #92400e; }
    .navbar__center { flex: 1; display: flex; justify-content: center; }
    .store-picker {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--clr-slate-50);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 6px 12px;
    }
    .store-picker__label { font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; font-weight: 500; }
    .store-picker__select {
      background: transparent;
      border: none;
      box-shadow: none;
      color: var(--text-primary);
      font-size: 0.85rem;
      font-weight: 600;
      width: auto;
      padding: 0;
      cursor: pointer;
      outline: none;
    }
    .store-picker__chevron { color: var(--text-muted); }
    .navbar__end { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .navbar__login,
    .navbar__register {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      padding: 0 14px;
      border-radius: var(--radius-md);
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      transition: all var(--trans-fast);
    }
    .navbar__login {
      color: var(--text-secondary);
      border: 1.5px solid var(--border-default);
    }
    .navbar__login:hover { background: var(--clr-slate-50); color: var(--text-primary); }
    .navbar__register {
      color: #fff;
      background: var(--clr-primary-600);
      box-shadow: 0 2px 8px rgba(2,132,199,.3);
    }
    .navbar__register:hover { background: var(--clr-primary-700); }
    .navbar__action {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--clr-slate-50);
      color: var(--text-secondary);
      text-decoration: none;
      transition: background var(--trans-fast), color var(--trans-fast);
      border: 1px solid var(--border-default);
    }
    .navbar__action:hover { background: var(--clr-primary-50); color: var(--clr-primary-600); border-color: var(--clr-primary-200); }
    .navbar__badge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 19px;
      height: 19px;
      padding: 0 4px;
      border-radius: var(--radius-full);
      background: var(--clr-primary-600);
      color: #fff;
      font-size: 0.6rem;
      font-weight: 700;
      line-height: 19px;
      text-align: center;
      box-shadow: 0 0 0 2px #fff;
    }
    .navbar__user { position: relative; }
    .navbar__user-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px 5px 5px;
      border: 1.5px solid var(--border-default);
      border-radius: var(--radius-md);
      background: #fff;
      color: var(--text-primary);
      font-size: 0.8rem;
      transition: border-color var(--trans-fast), box-shadow var(--trans-fast);
      max-width: 200px;
    }
    .navbar__user-btn:hover { border-color: var(--clr-primary-200); box-shadow: 0 0 0 3px var(--clr-primary-50); }
    .navbar__avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: var(--radius-full);
      background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .navbar__user-email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px; color: var(--text-secondary); }
    .navbar__chevron { color: var(--text-muted); transition: transform var(--trans-fast); flex-shrink: 0; }
    .navbar__chevron.rotated { transform: rotate(180deg); }
    .navbar__dropdown {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      width: 240px;
      background: #fff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      z-index: 200;
      overflow: hidden;
    }
    .navbar__dropdown-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: var(--clr-primary-50);
      border-bottom: 1px solid var(--clr-primary-100);
    }
    .navbar__dropdown-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-full);
      background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .navbar__dropdown-name { font-size: 0.8rem; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
    .navbar__dropdown-role { font-size: 0.68rem; color: var(--clr-primary-600); font-weight: 500; }
    .navbar__dropdown-divider { height: 1px; background: var(--border-default); }
    .navbar__dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      font-size: 0.875rem;
      color: var(--text-secondary);
      text-decoration: none;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      cursor: pointer;
      transition: background var(--trans-fast), color var(--trans-fast);
    }
    .navbar__dropdown-item:hover { background: var(--clr-slate-50); color: var(--text-primary); }
    .navbar__dropdown-item--danger { color: var(--clr-danger-500); }
    .navbar__dropdown-item--danger:hover { background: #fef2f2; color: var(--clr-danger-600); }
  `]
})
export class NavbarComponent {
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  @Input({ required: true }) layout!: NavbarLayout;
  @Input() homeLink = '/';
  @Input() cartCount = 0;
  @Input() profileLink = '/app/profile';
  @Input() ordersLink: string | string[] | null = '/app/orders';
  @Input() storeOptions: { id: string; name: string }[] = [];
  @Input() selectedStoreId: string | null = null;
  @Output() selectedStoreIdChange = new EventEmitter<string>();

  readonly menu = signal(false);

  get layoutLabel(): string {
    return this.layout === 'individual' ? 'Bireysel'
      : this.layout === 'corporate' ? 'Kurumsal'
      : 'Admin';
  }

  get userInitials(): string {
    const email = this.authStore.currentUser()?.email ?? '';
    return email.slice(0, 2).toUpperCase();
  }

  onStorePick(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.selectedStoreIdChange.emit(v);
  }

  logout(): void {
    this.menu.set(false);
    this.authStore.logout();
    void this.router.navigate(['/auth/login']);
  }
}
