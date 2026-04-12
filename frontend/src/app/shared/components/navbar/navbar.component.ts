import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';

export type NavbarLayout = 'individual' | 'corporate' | 'admin';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, NotificationPanelComponent],
  template: `
    <header class="bar">
      <a class="logo" [routerLink]="homeLink">{{ brand }}</a>
      <div class="mid">
        @if (layout === 'corporate' && storeOptions.length > 0) {
          <label class="store-label">
            Mağaza
            <select
              class="store-select"
              [value]="selectedStoreId ?? ''"
              (change)="onStorePick($event)"
            >
              @for (s of storeOptions; track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
          </label>
        }
      </div>
      <div class="end">
        @if (layout === 'individual') {
          <a class="icon-link" routerLink="/app/cart" aria-label="Sepet">
            🛒
            @if (cartCount > 0) {
              <span class="pill">{{ cartCount > 99 ? '99+' : cartCount }}</span>
            }
          </a>
        }
        <app-notification-panel [ordersLink]="ordersLink" />
        <div class="profile">
          <button type="button" class="user-btn" (click)="menu.set(!menu())">
            {{ authStore.currentUser()?.email ?? 'Hesap' }}
          </button>
          @if (menu()) {
            <div class="dropdown">
              <a [routerLink]="profileLink" (click)="menu.set(false)">Profil</a>
              <button type="button" class="out" (click)="logout()">Çıkış</button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 16px;
        background: #0f172a;
        color: #f8fafc;
        border-radius: 12px 12px 0 0;
      }
      .logo {
        color: inherit;
        font-weight: 700;
        text-decoration: none;
        letter-spacing: 0.02em;
      }
      .mid {
        flex: 1;
        display: flex;
        justify-content: center;
      }
      .store-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        color: #cbd5e1;
      }
      .store-select {
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        border: 1px solid #334155;
        background: #1e293b;
        color: #f8fafc;
      }
      .end {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .icon-link {
        position: relative;
        text-decoration: none;
        font-size: 1.15rem;
        padding: 0.35rem 0.45rem;
        border-radius: 10px;
        background: #1e293b;
      }
      .pill {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: #2563eb;
        color: #fff;
        font-size: 0.6rem;
        line-height: 16px;
        text-align: center;
      }
      .profile {
        position: relative;
      }
      .user-btn {
        border: 1px solid #334155;
        background: #1e293b;
        color: #e2e8f0;
        border-radius: 10px;
        padding: 0.4rem 0.65rem;
        cursor: pointer;
        font-size: 0.8rem;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dropdown {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        background: #fff;
        color: #0f172a;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        min-width: 160px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.15);
        z-index: 60;
        display: flex;
        flex-direction: column;
        padding: 6px;
      }
      .dropdown a {
        padding: 0.45rem 0.6rem;
        color: #0f172a;
        text-decoration: none;
        border-radius: 6px;
        font-size: 0.9rem;
      }
      .dropdown a:hover {
        background: #f1f5f9;
      }
      .out {
        margin-top: 4px;
        border: none;
        background: none;
        text-align: left;
        padding: 0.45rem 0.6rem;
        cursor: pointer;
        color: #b91c1c;
        font-size: 0.9rem;
        border-radius: 6px;
      }
      .out:hover {
        background: #fef2f2;
      }
    `
  ]
})
export class NavbarComponent {
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  @Input({ required: true }) layout!: NavbarLayout;
  @Input() homeLink = '/';
  @Input() brand = 'E-Analytics';
  @Input() cartCount = 0;
  @Input() profileLink = '/app/profile';
  @Input() ordersLink: string | string[] | null = '/app/orders';
  @Input() storeOptions: { id: string; name: string }[] = [];
  @Input() selectedStoreId: string | null = null;
  @Output() selectedStoreIdChange = new EventEmitter<string>();

  readonly menu = signal(false);

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
