import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NavbarComponent } from '../../components/navbar/navbar.component';
import { SidebarComponent, type AppSidebarLink } from '../../components/sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="layout">
      <app-navbar
        layout="admin"
        homeLink="/admin/dashboard"
        profileLink="/admin/profile"
        [ordersLink]="null"
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
export class AdminLayoutComponent {
  readonly links: AppSidebarLink[] = [
    { label: 'Dashboard', routerLink: '/admin/dashboard', exact: true },
    { label: 'Kullanicilar', routerLink: '/admin/users' },
    { label: 'Magazalar', routerLink: '/admin/stores' },
    { label: 'Kategoriler', routerLink: '/admin/categories' },
    { label: 'Audit Loglar', routerLink: '/admin/audit-logs' },
    { label: 'Analizler', routerLink: '/admin/analytics' },
    { label: 'Sistem Ayarlari', routerLink: '/admin/settings' }
  ];
}
