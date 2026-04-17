import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NavbarComponent } from '../../components/navbar/navbar.component';
import { SidebarComponent, type AppSidebarLink } from '../../components/sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="app-shell">
      <app-navbar
        layout="admin"
        homeLink="/admin/dashboard"
        profileLink="/admin/profile"
        [ordersLink]="null"
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
export class AdminLayoutComponent {
  readonly links: AppSidebarLink[] = [
    { label: 'Dashboard',      routerLink: '/admin/dashboard',  exact: true, icon: 'heroHome' },
    { label: 'Kullanıcılar',   routerLink: '/admin/users',                   icon: 'heroUsers' },
    { label: 'Mağazalar',      routerLink: '/admin/stores',                  icon: 'heroBuildingStorefront' },
    { label: 'Siparişler',     routerLink: '/admin/orders',                  icon: 'heroShoppingBag' },
    { label: 'Kategoriler',    routerLink: '/admin/categories',              icon: 'heroTag' },
    { label: 'Audit Loglar',   routerLink: '/admin/audit-logs',              icon: 'heroClipboardDocumentList' },
    { label: 'Analizler',      routerLink: '/admin/analytics',               icon: 'heroArrowTrendingUp' },
    { label: 'Sistem Ayarları',routerLink: '/admin/settings',                icon: 'heroCog6Tooth' }
  ];
}
