import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { SidebarComponent, type AppSidebarLink } from '../../components/sidebar/sidebar.component';

const LS_STORE = 'corporate_selected_store_id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-corporate-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="app-shell">
      <app-navbar
        layout="corporate"
        homeLink="/corporate/dashboard"
        profileLink="/corporate/profile"
        ordersLink="/corporate/orders"
        [storeOptions]="storeOptions()"
        [selectedStoreId]="selectedStoreId()"
        (selectedStoreIdChange)="onStoreChange($event)"
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
    .app-shell { display: flex; flex-direction: column; min-height: 100vh; }
    .app-body { display: flex; flex: 1; overflow: hidden; min-height: 0; }
    .app-main { flex: 1; overflow-y: auto; background: var(--surface-bg); }
    .app-content { padding: 28px 32px; max-width: 1400px; }
    @media (max-width: 768px) { .app-content { padding: 20px 16px; } }
  `]
})
export class CorporateLayoutComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly corpCtx = inject(CorporateContextService);

  readonly storeOptions = signal<{ id: string; name: string }[]>([]);
  readonly selectedStoreId = signal<string | null>(null);

  readonly links: AppSidebarLink[] = [
    { label: 'Dashboard',       routerLink: '/corporate/dashboard',        exact: true, icon: 'heroHome' },
    { label: 'Ürünlerim',       routerLink: '/corporate/products',                      icon: 'heroCube' },
    { label: 'Envanter',        routerLink: '/corporate/inventory',                     icon: 'heroSquaresPlus' },
    { label: 'Siparişler',      routerLink: '/corporate/orders',                        icon: 'heroShoppingBag' },
    { label: 'Kuponlar',        routerLink: '/corporate/coupons',                       icon: 'heroTag' },
    { label: 'Mağaza Ayarları', routerLink: '/corporate/store-settings',               icon: 'heroBuildingStorefront' },
    { label: 'Analizler',       routerLink: '/corporate/analytics',                     icon: 'heroChartBar' },
    { label: 'AI Chat',         routerLink: '/corporate/chat',                          icon: 'heroChatBubbleLeftEllipsis' },
    { label: 'Değerlendirmeler',routerLink: '/corporate/reviews',                       icon: 'heroStar' },
    { label: 'Müşteri Analizi', routerLink: '/corporate/customers',                     icon: 'heroUserGroup' },
    { label: 'Gelir Raporu',    routerLink: '/corporate/revenue-drilldown',             icon: 'heroCurrencyDollar' }
  ];

  constructor() {
    effect(() => {
      const ids = this.authStore.ownedStoreIds();
      const names = this.authStore.ownedStoreNames();
      const options = ids
        .map((id, index) => ({
          id,
          name: names[index] ?? `Store ${index + 1}`
        }))
        .filter((option) => UUID_PATTERN.test(option.id));
      this.storeOptions.set(options);

      const saved = localStorage.getItem(LS_STORE);
      const first = options[0]?.id ?? null;
      const pick = saved && options.some((option) => option.id === saved) ? saved : first;

      this.selectedStoreId.set(pick);
      this.corpCtx.setSelectedStoreId(pick);

      if (pick) {
        localStorage.setItem(LS_STORE, pick);
      } else {
        localStorage.removeItem(LS_STORE);
      }
    });
  }

  ngOnInit(): void {
    this.authStore.ensureProfileLoaded().subscribe(() => {
      if (this.authStore.isCorporate() && this.authStore.ownedStoreIds().length === 0) {
        this.authStore.loadScope().subscribe();
      }
    });
  }

  onStoreChange(id: string): void {
    if (!UUID_PATTERN.test(id)) {
      this.selectedStoreId.set(null);
      this.corpCtx.setSelectedStoreId(null);
      localStorage.removeItem(LS_STORE);
      return;
    }
    this.selectedStoreId.set(id);
    this.corpCtx.setSelectedStoreId(id);
    localStorage.setItem(LS_STORE, id);
  }
}
