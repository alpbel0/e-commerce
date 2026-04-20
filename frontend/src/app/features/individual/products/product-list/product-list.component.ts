import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CartService } from '../../../../core/api/cart.service';
import { CategoryService } from '../../../../core/api/category.service';
import { CurrencyRateService } from '../../../../core/api/currency-rate.service';
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
      /* ---- Page header ---- */
      .list-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .list-header__copy {
        display: flex;
        align-items: baseline;
        gap: 12px;
        flex-wrap: wrap;
      }
      .list-header__actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .list-title {
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -.02em;
      }
      .list-count {
        font-size: 0.85rem;
        color: var(--text-muted);
      }
      .currency-switch {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 0.5rem 0.8rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-default);
        background: rgba(255, 255, 255, 0.9);
        box-shadow: var(--shadow-sm);
      }
      .currency-switch label {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .currency-switch select {
        min-width: 88px;
        border: 0;
        background: transparent;
        color: var(--text-primary);
        font-size: 0.9rem;
        font-weight: 700;
        outline: none;
        padding-right: 0.25rem;
      }

      /* ---- Grid ---- */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 20px;
        margin-bottom: 32px;
      }
      @media (max-width: 640px) {
        .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      }

      /* ---- Card ---- */
      .card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: box-shadow var(--trans-base), transform var(--trans-base);
      }
      .card:hover {
        box-shadow: var(--shadow-card-hover);
        transform: translateY(-3px);
      }

      /* ---- Image area ---- */
      .cover {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        background: var(--clr-slate-50);
        display: block;
        overflow: hidden;
      }
      .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--trans-slow);
      }
      .card:hover .cover img {
        transform: scale(1.04);
      }
      .cover-empty {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        background: linear-gradient(135deg, #f0fdf4, #f8fafc);
      }

      /* Discount badge */
      .discount-pill {
        position: absolute;
        top: 10px;
        left: 10px;
        background: var(--clr-danger-500);
        color: #fff;
        font-size: 0.7rem;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: var(--radius-full);
        letter-spacing: .02em;
        box-shadow: 0 2px 6px rgba(239,68,68,.4);
      }

      /* Wishlist overlay button */
      .wishlist-overlay {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 34px;
        height: 34px;
        border-radius: var(--radius-full);
        background: rgba(255,255,255,.92);
        border: 1px solid var(--border-default);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        cursor: pointer;
        opacity: 0;
        transition: opacity var(--trans-fast), color var(--trans-fast), background var(--trans-fast);
        box-shadow: var(--shadow-sm);
      }
      .card:hover .wishlist-overlay {
        opacity: 1;
      }
      .wishlist-overlay:hover {
        color: var(--clr-danger-500);
        background: #fff;
      }

      /* ---- Content ---- */
      .content {
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
      }
      .meta {
        font-size: 0.74rem;
        color: var(--text-muted);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: .04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .card h3 {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.35;
      }
      .title {
        color: var(--text-primary);
        text-decoration: none;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .title:hover { color: var(--clr-primary-600); }

      /* Stars */
      .stars {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .star-icons {
        color: var(--clr-accent-500);
        font-size: 0.8rem;
        letter-spacing: 1px;
      }
      .review-count {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      /* Price */
      .price-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 2px;
      }
      .price {
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--text-primary);
      }
      .old {
        text-decoration: line-through;
        color: var(--text-muted);
        font-size: 0.82rem;
      }

      /* Out of stock */
      .stock-badge {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--clr-danger-500);
        background: #fef2f2;
        padding: 2px 8px;
        border-radius: var(--radius-full);
        border: 1px solid #fecaca;
      }

      /* Actions */
      .actions {
        margin-top: auto;
        padding-top: 10px;
        display: flex;
        gap: 8px;
      }
      .btn-cart {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 0.5rem 0.5rem;
        border-radius: var(--radius-md);
        border: none;
        background: var(--clr-primary-600);
        color: #fff;
        cursor: pointer;
        font-size: 0.82rem;
        font-weight: 600;
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
      }
      .btn-cart:hover:not(:disabled) {
        background: var(--clr-primary-700);
        box-shadow: 0 4px 12px rgba(2,132,199,.35);
      }
      .btn-cart:disabled { opacity: .45; cursor: not-allowed; }
      .btn-detail {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 12px;
        border-radius: var(--radius-md);
        border: 1.5px solid var(--border-default);
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 600;
        transition: border-color var(--trans-fast), color var(--trans-fast), background var(--trans-fast);
        white-space: nowrap;
      }
      .btn-detail:hover { border-color: var(--clr-primary-500); color: var(--clr-primary-600); background: var(--clr-primary-50); }
    `
  ]
})
export class ProductListComponent implements OnInit {
  private static readonly STORAGE_KEY = 'individual-product-list-currency';

  private readonly products = inject(ProductService);
  private readonly currencyRates = inject(CurrencyRateService);
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
  readonly selectedCurrency = signal<'TRY' | 'USD' | 'EUR'>('TRY');
  readonly currencyRatesMap = signal<Record<string, number>>({ USD: 1 });

  readonly currencyOptions = [
    { code: 'TRY', label: 'TL' },
    { code: 'USD', label: 'USD' },
    { code: 'EUR', label: 'EUR' }
  ] as const;

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
  readonly imageAlt = (p: ProductSummaryResponse) => `${p.title} kapak görseli`;
  readonly discountPercent = (p: ProductSummaryResponse) =>
    Math.round(parseFloat(p.discountPercentage || '0'));

  ngOnInit(): void {
    this.restoreCurrencyPreference();
    this.currencyRates.listRates().subscribe({
      next: (rates) => {
        const nextRates: Record<string, number> = { USD: 1 };
        for (const rate of rates) {
          const target = rate.targetCurrency?.trim().toUpperCase();
          const parsed = Number(rate.rate);
          if (target && Number.isFinite(parsed) && parsed > 0) {
            nextRates[target] = parsed;
          }
        }
        this.currencyRatesMap.set(nextRates);
      },
      error: () => this.currencyRatesMap.set({ USD: 1 })
    });
    this.categories.list().subscribe({
      next: (r) => this.categoriesList.set(r.items),
      error: () => this.categoriesList.set([])
    });
    this.stores.list({ page: 0, size: 200 }).subscribe({
      next: (r) =>
        this.storesList.set(
          r.items.filter((store) => (store.productCount ?? 0) > 0)
        ),
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

  onCurrencyChange(currency: string): void {
    if (currency === 'TRY' || currency === 'USD' || currency === 'EUR') {
      this.selectedCurrency.set(currency);
      this.persistCurrencyPreference();
    }
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

  displayEffectivePrice(p: ProductSummaryResponse): string {
    return formatMoney(this.convertAmount(this.effectivePrice(p), p.currency, this.selectedCurrency()), this.selectedCurrency());
  }

  displayOriginalPrice(p: ProductSummaryResponse): string {
    return formatMoney(this.convertAmount(Number(p.unitPrice), p.currency, this.selectedCurrency()), this.selectedCurrency());
  }

  private convertAmount(amount: number, fromCurrency: string | null | undefined, targetCurrency: 'TRY' | 'USD' | 'EUR'): number {
    if (!Number.isFinite(amount)) {
      return 0;
    }

    const normalizedFrom = (fromCurrency ?? 'USD').trim().toUpperCase();
    if (normalizedFrom === targetCurrency) {
      return amount;
    }

    const rates = this.currencyRatesMap();
    const fromRate = rates[normalizedFrom];
    const targetRate = rates[targetCurrency];
    if (!fromRate || !targetRate) {
      return amount;
    }

    const usdAmount = normalizedFrom === 'USD' ? amount : amount / fromRate;
    return targetCurrency === 'USD' ? usdAmount : usdAmount * targetRate;
  }

  private restoreCurrencyPreference(): void {
    try {
      const saved = localStorage.getItem(ProductListComponent.STORAGE_KEY);
      if (saved === 'TRY' || saved === 'USD' || saved === 'EUR') {
        this.selectedCurrency.set(saved);
      }
    } catch {
      this.selectedCurrency.set('TRY');
    }
  }

  private persistCurrencyPreference(): void {
    try {
      localStorage.setItem(ProductListComponent.STORAGE_KEY, this.selectedCurrency());
    } catch {
      // Ignore storage failures and keep in-memory preference.
    }
  }

  private redirectToLogin(): void {
    void this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/app/products' } });
  }
}
