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
      h2 {
        margin: 0 0 1rem;
      }
      .store-block {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        background: #fff;
      }
      .store-block h3 {
        margin: 0 0 12px;
        font-size: 1.05rem;
      }
      .coupon-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
        font-size: 0.9rem;
      }
      .coupon-row select {
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
      .currency-row {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: 0.9rem;
      }
      .currency-row select {
        width: auto;
        min-width: 110px;
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
      .coupon-row button {
        padding: 0.35rem 0.65rem;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .coupon-row .apply {
        background: #2563eb;
        color: #fff;
      }
      .coupon-row .remove {
        background: #fef2f2;
        color: #b91c1c;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      th,
      td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #f1f5f9;
      }
      .qty {
        width: 72px;
        padding: 0.3rem;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
      }
      .totals {
        margin-top: 10px;
        text-align: right;
        font-size: 0.9rem;
        color: #475569;
      }
      .grand {
        font-weight: 700;
        color: #0f172a;
        font-size: 1rem;
        margin-top: 4px;
      }
      .actions {
        margin-top: 1.5rem;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .checkout {
        padding: 0.55rem 1.2rem;
        border-radius: 10px;
        background: #0f172a;
        color: #fff;
        text-decoration: none;
        font-weight: 600;
      }
      .muted {
        color: #94a3b8;
        font-size: 0.85rem;
      }
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
