import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../../../core/api/cart.service';
import { CategoryService } from '../../../../core/api/category.service';
import { ProductService } from '../../../../core/api/product.service';
import { StoreService } from '../../../../core/api/store.service';
import { WishlistService } from '../../../../core/api/wishlist.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import type { CategoryResponse } from '../../../../core/models/category.models';
import type { ProductSummaryResponse } from '../../../../core/models/product.models';
import type { StoreSummaryResponse } from '../../../../core/models/store.models';
import { ToastService } from '../../../../core/notify/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { effectiveUnitPrice, formatMoney, starsFromRating } from '../../../../shared/util/money';
import {
  ProductFiltersComponent,
  type ProductFilterValues
} from '../product-filters/product-filters.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    RouterLink,
    ProductFiltersComponent,
    PaginationComponent,
    LoadingSpinnerComponent,
    ErrorStateComponent,
    EmptyStateComponent
  ],
  templateUrl: './product-list.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        background: #fff;
        overflow: hidden;
      }
      .cover {
        width: 100%;
        aspect-ratio: 4 / 3;
        background: linear-gradient(135deg, #eff6ff, #f8fafc);
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cover-empty {
        color: #94a3b8;
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .content {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
      }
      .card h3 {
        margin: 0;
        font-size: 1rem;
        line-height: 1.3;
      }
      .card a.title {
        color: #0f172a;
        text-decoration: none;
      }
      .card a.title:hover {
        text-decoration: underline;
      }
      .meta {
        font-size: 0.8rem;
        color: #64748b;
      }
      .price-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
      }
      .old {
        text-decoration: line-through;
        color: #94a3b8;
        font-size: 0.85rem;
      }
      .price {
        font-weight: 700;
        color: #0f172a;
      }
      .stars {
        color: #f59e0b;
        letter-spacing: 1px;
        font-size: 0.85rem;
      }
      .actions {
        margin-top: auto;
        display: flex;
        gap: 8px;
      }
      .actions button {
        flex: 1;
        padding: 0.45rem 0.6rem;
        border-radius: 8px;
        border: none;
        background: #2563eb;
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .actions button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .actions a.detail {
        flex: 1;
        text-align: center;
        padding: 0.45rem 0.6rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        color: #334155;
        text-decoration: none;
        font-size: 0.85rem;
      }
      .wishlist-btn {
        flex: 0 0 auto !important;
        padding: 0.45rem 0.5rem !important;
        background: #fef2f2 !important;
        color: #ef4444 !important;
        border: 1px solid #fecaca !important;
      }
      .wishlist-btn:hover {
        background: #fee2e2 !important;
      }
    `
  ]
})
export class ProductListComponent implements OnInit {
  private readonly products = inject(ProductService);
  private readonly categories = inject(CategoryService);
  private readonly stores = inject(StoreService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly items = signal<ProductSummaryResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly categoriesList = signal<CategoryResponse[]>([]);
  readonly storesList = signal<StoreSummaryResponse[]>([]);

  private filterState: ProductFilterValues = {
    categoryId: null,
    storeId: null,
    q: '',
    sort: 'createdAt,desc'
  };

  readonly formatMoney = formatMoney;
  readonly effectivePrice = (p: ProductSummaryResponse) =>
    effectiveUnitPrice(p.unitPrice, p.discountPercentage);
  readonly stars = (p: ProductSummaryResponse) => starsFromRating(p.avgRating);
  readonly starString = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  readonly imageAlt = (p: ProductSummaryResponse) => `${p.title} kapak gorseli`;

  ngOnInit(): void {
    this.categories.list().subscribe({
      next: (r) => this.categoriesList.set(r.items),
      error: () => this.categoriesList.set([])
    });
    this.stores.list({ page: 0, size: 200 }).subscribe({
      next: (r) => this.storesList.set(r.items),
      error: () => this.storesList.set([])
    });
  }

  onFilters(v: ProductFilterValues): void {
    this.filterState = v;
    this.page.set(0);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.products
      .list({
        page: this.page(),
        size: 24,
        sort: this.filterState.sort,
        categoryId: this.filterState.categoryId ?? undefined,
        storeId: this.filterState.storeId ?? undefined,
        q: this.filterState.q || undefined,
        active: true
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.items.set(res.items);
          this.totalPages.set(res.totalPages);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        }
      });
  }

  onPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  addToCart(p: ProductSummaryResponse): void {
    if (!p.active || p.stockQuantity <= 0) return;
    if (!this.authStore.isLoggedIn()) {
      this.redirectToLogin();
      return;
    }
    this.cart.addItem({ productId: p.id, quantity: 1 }).subscribe({
      next: () => this.toast.showInfo('Sepete eklendi'),
      error: () => {}
    });
  }

  addToWishlist(p: ProductSummaryResponse, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.authStore.isLoggedIn()) {
      this.redirectToLogin();
      return;
    }
    this.wishlist.addToWishlist(p.id).subscribe({
      next: () => this.toast.showInfo('Favorilere eklendi'),
      error: () => this.toast.showError('Favorilere eklenemedi')
    });
  }

  canAdd(p: ProductSummaryResponse): boolean {
    return p.active && p.stockQuantity > 0;
  }

  showDiscount(p: ProductSummaryResponse): boolean {
    return parseFloat(p.discountPercentage || '0') > 0;
  }

  hasImage(p: ProductSummaryResponse): boolean {
    return !!p.primaryImageUrl;
  }

  private redirectToLogin(): void {
    void this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/app/products' } });
  }
}
