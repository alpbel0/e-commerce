import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';

import { ProductService } from '../../../core/api/product.service';
import { StoreService } from '../../../core/api/store.service';
import type { ProductSummaryResponse } from '../../../core/models/product.models';
import type { StoreDetailResponse } from '../../../core/models/store.models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-store-public',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent],
  template: `
    <a routerLink="/app/products" class="back-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 18-6-6 6-6"/></svg>
      Ürünlere Dön
    </a>

    @if (loading()) {
      <app-loading-spinner />
    } @else if (error()) {
      <app-error-state message="Mağaza yüklenemedi." (retry)="load()" />
    } @else {
      @if (store(); as item) {
        <!-- Store header -->
        <div class="store-header">
          <div class="store-avatar">{{ item.name.charAt(0).toUpperCase() }}</div>
          <div class="store-info">
            <h1 class="store-name">{{ item.name }}</h1>
            @if (item.description) {
              <p class="store-desc">{{ item.description }}</p>
            }
            <div class="store-meta">
              @if (item.contactEmail) {
                <span class="store-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  {{ item.contactEmail }}
                </span>
              }
              @if (item.address) {
                <span class="store-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {{ item.address }}
                </span>
              }
            </div>
          </div>
        </div>

        <!-- Products -->
        <div class="section-header">
          <h2 class="section-title">Ürünler</h2>
          <span class="section-count">{{ products().length }} ürün</span>
        </div>

        @if (products().length === 0) {
          <p class="empty-msg">Bu mağazada aktif ürün bulunmuyor.</p>
        } @else {
          <div class="grid">
            @for (product of products(); track product.id) {
              <a class="card" [routerLink]="['/app/products', product.id]">
                <div class="card-title">{{ product.title }}</div>
                <div class="card-price">{{ formatMoney(product.unitPrice, product.currency) }}</div>
              </a>
            }
          </div>
        }
      }
    }
  `,
  styles: [`
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 20px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: color var(--trans-fast);
    }
    .back-link:hover { color: var(--clr-primary-600); }

    /* Store header */
    .store-header {
      display: flex;
      align-items: flex-start;
      gap: 20px;
      padding: 28px;
      background: #fff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-sm);
      margin-bottom: 28px;
    }
    .store-avatar {
      width: 64px; height: 64px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700));
      color: #fff;
      font-size: 1.5rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(2,132,199,.3);
    }
    .store-info { flex: 1; }
    .store-name { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin: 0 0 6px; letter-spacing: -.02em; }
    .store-desc { color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 10px; line-height: 1.6; }
    .store-meta { display: flex; flex-wrap: wrap; gap: 14px; }
    .store-meta-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* Section header */
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .section-title { font-size: 1.1rem; font-weight: 800; margin: 0; }
    .section-count { font-size: 0.8rem; color: var(--text-muted); }

    .empty-msg { color: var(--text-muted); font-size: 0.9rem; padding: 24px 0; }

    /* Product grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
    .card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      background: #fff;
      text-decoration: none;
      color: inherit;
      transition: box-shadow var(--trans-base), transform var(--trans-base);
    }
    .card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
    .card-title { font-size: 0.88rem; font-weight: 600; color: var(--text-primary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-price { font-size: 1rem; font-weight: 800; color: var(--clr-primary-600); margin-top: auto; }
  `]
})
export class StorePublicComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly stores = inject(StoreService);
  private readonly productsApi = inject(ProductService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly store = signal<StoreDetailResponse | null>(null);
  readonly products = signal<ProductSummaryResponse[]>([]);
  readonly formatMoney = formatMoney;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.stores.getBySlug(slug).subscribe({
      next: (store) => {
        this.store.set(store);
        this.productsApi.list({ storeId: store.id, active: true, page: 0, size: 24, sort: 'title,asc' }).subscribe({
          next: (response) => {
            this.loading.set(false);
            this.products.set(response.items);
          },
          error: () => {
            this.loading.set(false);
            this.error.set(true);
          }
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
