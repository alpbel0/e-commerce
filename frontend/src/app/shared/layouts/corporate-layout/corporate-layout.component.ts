import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { SidebarComponent, type AppSidebarLink } from '../../components/sidebar/sidebar.component';

const LS_STORE = 'corporate_selected_store_id';

@Component({
  selector: 'app-corporate-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="layout">
      <app-navbar
        layout="corporate"
        homeLink="/corporate/dashboard"
        profileLink="/corporate/profile"
        ordersLink="/corporate/orders"
        [storeOptions]="storeOptions()"
        [selectedStoreId]="selectedStoreId()"
        (selectedStoreIdChange)="onStoreChange($event)"
      />
      <div class="body">
        <app-sidebar [links]="links" />
        <main class="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .layout {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
        background: #fff;
      }
      .body {
        display: flex;
        align-items: stretch;
        min-height: 360px;
        background: #f8fafc;
      }
      .main {
        flex: 1;
        padding: 20px 24px;
        background: #fff;
        border-left: 1px solid #e2e8f0;
      }
    `
  ]
})
export class CorporateLayoutComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly corpCtx = inject(CorporateContextService);

  readonly storeOptions = signal<{ id: string; name: string }[]>([]);
  readonly selectedStoreId = signal<string | null>(null);

  readonly links: AppSidebarLink[] = [
    { label: 'Dashboard', routerLink: '/corporate/dashboard', exact: true },
    { label: 'Urunlerim', routerLink: '/corporate/products' },
    { label: 'Envanter', routerLink: '/corporate/inventory' },
    { label: 'Siparisler', routerLink: '/corporate/orders' },
    { label: 'Kuponlar', routerLink: '/corporate/coupons' },
    { label: 'Magaza Ayarlari', routerLink: '/corporate/store-settings' },
    { label: 'Analizler', routerLink: '/corporate/analytics' },
    { label: 'Review Management', routerLink: '/corporate/reviews' },
    { label: 'Musteri Analizi', routerLink: '/corporate/customers' },
    { label: 'Gelir Drill-down', routerLink: '/corporate/revenue-drilldown' }
  ];

  constructor() {
    effect(() => {
      const ids = this.authStore.ownedStoreIds();
      const names = this.authStore.ownedStoreNames();
      const options = ids.map((id, index) => ({
        id,
        name: names[index] ?? `Store ${index + 1}`
      }));
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
    this.selectedStoreId.set(id);
    this.corpCtx.setSelectedStoreId(id);
    localStorage.setItem(LS_STORE, id);
  }
}
