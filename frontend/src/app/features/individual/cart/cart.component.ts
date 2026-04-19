import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { CartService } from '../../../core/api/cart.service';
import { CurrencyRateService } from '../../../core/api/currency-rate.service';
import type { CartResponse, StoreCartResponse } from '../../../core/models/cart.models';
import type { CouponResponse } from '../../../core/models/coupon.models';
import { ToastService } from '../../../core/notify/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './cart.component.html',
  styles: [
    `
      /* Header */
      .cart-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      }
      .page-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; margin: 0; }
      .currency-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .currency-wrap select {
        width: auto;
        min-width: 90px;
        height: 36px;
        padding: 0 10px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 0.82rem;
        font-weight: 600;
        background: #fff;
      }

      /* Layout */
      .cart-layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 24px;
        align-items: start;
      }
      @media (max-width: 900px) { .cart-layout { grid-template-columns: 1fr; } }

      /* Store block */
      .store-block {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        margin-bottom: 16px;
        box-shadow: var(--shadow-sm);
      }
      .store-block__header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-default);
        background: var(--clr-slate-50);
      }
      .store-block__icon {
        width: 30px; height: 30px;
        background: var(--clr-primary-50);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--clr-primary-600);
      }
      .store-block__name { font-size: 0.95rem; font-weight: 700; margin: 0; flex: 1; }
      .coupon-badge {
        background: #d1fae5; color: #065f46;
        font-size: 0.72rem; font-weight: 700;
        padding: 2px 8px; border-radius: var(--radius-full);
        border: 1px solid #a7f3d0;
      }

      /* Coupon row */
      .coupon-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border-bottom: 1px solid var(--border-default);
        background: #fffbf0;
        font-size: 0.85rem;
      }
      .coupon-active { font-weight: 600; color: #065f46; }
      .coupon-select {
        height: 32px;
        padding: 0 8px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 0.82rem;
        width: auto;
        min-width: 160px;
      }
      .btn-coupon-apply {
        padding: 0 12px; height: 32px;
        border: none;
        border-radius: var(--radius-md);
        background: var(--clr-primary-600); color: #fff;
        font-size: 0.8rem; font-weight: 700;
        cursor: pointer;
        transition: background var(--trans-fast);
      }
      .btn-coupon-apply:hover { background: var(--clr-primary-700); }
      .btn-coupon-remove {
        padding: 0 10px; height: 32px;
        border: 1px solid #fecaca;
        border-radius: var(--radius-md);
        background: #fef2f2; color: var(--clr-danger-600);
        font-size: 0.8rem; font-weight: 600;
        cursor: pointer;
        transition: background var(--trans-fast);
      }
      .btn-coupon-remove:hover { background: #fee2e2; }

      /* Table */
      .ec-table { padding: 0 8px; }
      .item-name { font-weight: 500; max-width: 260px; }
      .qty-input {
        width: 68px;
        height: 34px;
        text-align: center;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        font-weight: 600;
        padding: 0 8px;
      }
      .btn-remove-item {
        width: 32px; height: 32px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-default);
        background: transparent;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all var(--trans-fast);
      }
      .btn-remove-item:hover { background: #fef2f2; color: var(--clr-danger-500); border-color: #fecaca; }

      /* Store totals */
      .store-totals { padding: 14px 20px; border-top: 1px solid var(--border-default); background: var(--clr-slate-50); }
      .store-total-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.875rem;
        color: var(--text-secondary);
        padding: 3px 0;
      }
      .store-total-row--discount { color: #065f46; }
      .store-total-row--grand { font-weight: 800; font-size: 1rem; color: var(--text-primary); padding-top: 8px; border-top: 1px solid var(--border-default); margin-top: 6px; }

      /* Summary sidebar */
      .cart-summary { position: sticky; top: calc(var(--navbar-h) + var(--topnav-h) + 16px); }
      .summary-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        padding: 20px;
        box-shadow: var(--shadow-sm);
      }
      .summary-title { font-size: 1rem; font-weight: 800; margin: 0 0 16px; }
      .summary-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.875rem;
        color: var(--text-secondary);
        padding: 6px 0;
        border-bottom: 1px solid var(--border-default);
        margin-bottom: 16px;
      }
      .summary-row--total { font-size: 1.15rem; font-weight: 800; color: var(--text-primary); border-bottom: none; margin-bottom: 0; }
      .btn-checkout {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        padding: 0.7rem;
        background: var(--clr-primary-600);
        color: #fff;
        border-radius: var(--radius-md);
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 700;
        margin-top: 14px;
        transition: background var(--trans-fast), box-shadow var(--trans-fast);
        box-shadow: 0 4px 12px rgba(2,132,199,.3);
      }
      .btn-checkout:hover { background: var(--clr-primary-700); color: #fff; }
      .btn-continue {
        display: block;
        text-align: center;
        margin-top: 10px;
        font-size: 0.82rem;
        color: var(--text-secondary);
        text-decoration: none;
        padding: 8px;
        border-radius: var(--radius-md);
        border: 1.5px solid var(--border-default);
        transition: all var(--trans-fast);
      }
      .btn-continue:hover { border-color: var(--clr-primary-200); color: var(--clr-primary-600); background: var(--clr-primary-50); }
    `
  ]
})
export class CartComponent implements OnInit {
  private readonly cartApi = inject(CartService);
  private readonly currencyRatesApi = inject(CurrencyRateService);
  private readonly toast = inject(ToastService);

  readonly cart = signal<CartResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  /** storeId -> available coupons */
  readonly couponOptions = signal<Record<string, CouponResponse[]>>({});
  readonly selectedCoupon = signal<Record<string, string>>({});
  readonly displayCurrency = signal('');
  readonly usdRates = signal<Record<string, number>>({ USD: 1 });
  readonly availableCurrencies = signal<string[]>(['TRY', 'USD', 'EUR']);

  readonly formatMoney = formatMoney;

  ngOnInit(): void {
    this.loadCurrencyRates();
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(false);
    this.cartApi.getMyCart().subscribe({
      next: (c) => {
        this.loading.set(false);
        this.applyCartState(c);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  private prefetchCoupons(c: CartResponse): void {
    if (c.stores.length === 0) {
      this.couponOptions.set({});
      this.selectedCoupon.set({});
      return;
    }
    const reqs = c.stores.map((s) =>
      this.cartApi.listStoreCoupons(s.storeId).pipe(catchError(() => of({ items: [], count: 0 })))
    );
    forkJoin(reqs).subscribe((results) => {
      const map: Record<string, CouponResponse[]> = {};
      const sel: Record<string, string> = {};
      c.stores.forEach((s, i) => {
        map[s.storeId] = results[i].items;
        sel[s.storeId] = s.activeCoupon?.code ?? '';
      });
      this.couponOptions.set(map);
      this.selectedCoupon.set(sel);
    });
  }

  updateQty(_storeId: string, itemId: string, quantity: number): void {
    if (quantity < 0) return;
    this.cartApi.updateItem(itemId, { quantity }).subscribe({
      next: (c) => {
        this.applyCartState(c);
        this.toast.showInfo('Sepet güncellendi');
      },
      error: () => {}
    });
  }

  removeItem(itemId: string): void {
    this.cartApi.removeItem(itemId).subscribe({
      next: (c) => this.applyCartState(c),
      error: () => {}
    });
  }

  applyCoupon(storeId: string): void {
    const code = this.selectedCoupon()[storeId]?.trim();
    if (!code) return;
    this.cartApi.applyCoupon(storeId, { code: code }).subscribe({
      next: (c) => {
        this.applyCartState(c);
        this.toast.showInfo('Kupon uygulandı');
      },
      error: () => {}
    });
  }

  removeCoupon(storeId: string): void {
    this.cartApi.removeCoupon(storeId).subscribe({
      next: (c) => this.applyCartState(c),
      error: () => {}
    });
  }

  setCouponSelect(storeId: string, code: string): void {
    this.selectedCoupon.set({ ...this.selectedCoupon(), [storeId]: code });
  }

  couponsFor(storeId: string): CouponResponse[] {
    return this.couponOptions()[storeId] ?? [];
  }

  private applyCartState(c: CartResponse): void {
    this.cart.set(c);
    this.setInitialDisplayCurrency(c);
    this.prefetchCoupons(c);
  }

  canCheckout(): boolean {
    const c = this.cart();
    return !!c && c.totalItemCount > 0;
  }

  storeHasDiscount(s: StoreCartResponse): boolean {
    return parseFloat(s.discountApplied || '0') > 0;
  }

  setDisplayCurrency(currency: string): void {
    const normalized = this.normalizeCurrency(currency);
    if (normalized) {
      this.displayCurrency.set(normalized);
    }
  }

  selectedDisplayCurrency(): string {
    return this.displayCurrency() || 'USD';
  }

  formatDisplayMoney(value: string | number | null | undefined, fromCurrency: string | null | undefined): string {
    const targetCurrency = this.selectedDisplayCurrency();
    return formatMoney(this.convertMoney(value, fromCurrency, targetCurrency), targetCurrency);
  }

  convertedGrandTotal(): number {
    const c = this.cart();
    if (!c) return 0;
    const targetCurrency = this.selectedDisplayCurrency();
    return c.stores.reduce((sum, store) => sum + this.convertMoney(store.grandTotal, store.currency, targetCurrency), 0);
  }

  private loadCurrencyRates(): void {
    this.currencyRatesApi.listRates().subscribe({
      next: (rates) => {
        const rateMap: Record<string, number> = { USD: 1 };
        for (const rate of rates) {
          const value = parseFloat(rate.rate);
          if (!Number.isNaN(value) && value > 0) {
            rateMap[rate.targetCurrency] = value;
          }
        }
        this.usdRates.set(rateMap);
        this.availableCurrencies.set(Object.keys(rateMap).sort());
        const currentCurrency = this.displayCurrency();
        if (currentCurrency && !rateMap[currentCurrency]) {
          this.displayCurrency.set(rateMap['TRY'] ? 'TRY' : 'USD');
        }
      },
      error: () => {
        this.usdRates.set({ USD: 1 });
        this.availableCurrencies.set(['USD']);
        this.displayCurrency.set('USD');
      }
    });
  }

  private setInitialDisplayCurrency(c: CartResponse): void {
    if (this.displayCurrency()) {
      return;
    }
    const firstStoreCurrency = c.stores
      .map((store) => this.normalizeCurrency(store.currency))
      .find((currency) => currency && currency !== 'MIXED');
    this.displayCurrency.set(firstStoreCurrency ?? (this.availableCurrencies().includes('TRY') ? 'TRY' : 'USD'));
  }

  private convertMoney(
    value: string | number | null | undefined,
    fromCurrency: string | null | undefined,
    targetCurrency: string
  ): number {
    if (value == null || value === '') return 0;
    const amount = typeof value === 'string' ? parseFloat(value) : value;
    if (Number.isNaN(amount)) return 0;

    const sourceCurrency = this.normalizeCurrency(fromCurrency);
    if (!sourceCurrency || sourceCurrency === 'MIXED') {
      return amount;
    }
    const rates = this.usdRates();
    const sourceRate = rates[sourceCurrency] ?? 0;
    const targetRate = rates[targetCurrency] ?? 0;
    if (sourceRate <= 0 || targetRate <= 0) {
      return amount;
    }
    return (amount / sourceRate) * targetRate;
  }

  private normalizeCurrency(currency: string | null | undefined): string {
    return currency?.trim().toUpperCase() ?? '';
  }
}
