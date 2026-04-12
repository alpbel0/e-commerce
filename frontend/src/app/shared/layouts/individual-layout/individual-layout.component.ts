import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CartService } from '../../../core/api/cart.service';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { SidebarComponent, type AppSidebarLink } from '../../components/sidebar/sidebar.component';

@Component({
  selector: 'app-individual-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="layout">
      <app-navbar
        layout="individual"
        homeLink="/app/home"
        [cartCount]="cartCount()"
        profileLink="/app/profile"
        ordersLink="/app/orders"
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
export class IndividualLayoutComponent implements OnInit {
  private readonly cart = inject(CartService);

  readonly cartCount = signal(0);

  readonly links: AppSidebarLink[] = [
    { label: 'Ana Sayfa', routerLink: '/app/home', exact: true },
    { label: 'Ürünler', routerLink: '/app/products' },
    { label: 'Siparişlerim', routerLink: '/app/orders' },
    { label: 'Profilim', routerLink: '/app/profile' },
    { label: 'Chat', routerLink: '/chat' }
  ];

  ngOnInit(): void {
    this.cart.getMyCart().subscribe({
      next: (c) => this.cartCount.set(c.totalItemCount),
      error: () => this.cartCount.set(0)
    });
  }
}
