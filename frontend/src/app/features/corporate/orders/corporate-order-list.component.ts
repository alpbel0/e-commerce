import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CurrencyRateService } from '../../../core/api/currency-rate.service';
import { OrderService } from '../../../core/api/order.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import type { OrderSummaryResponse } from '../../../core/models/order.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-corporate-order-list',
  standalone: true,
  imports: [RouterLink, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent, PaginationComponent],
  templateUrl: './corporate-order-list.component.html',
  styles: [
    `
      .page-header { margin-bottom: 4px; }
      .page-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.02em; margin: 0 0 4px; }
      .hint { font-size: 0.82rem; color: var(--text-muted); margin: 0 0 20px; }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 12px 16px;
        margin-bottom: 16px;
        box-shadow: var(--shadow-sm);
      }
      .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .filters label { display: flex; flex-direction: column; gap: 3px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
      .filters select {
        height: 36px;
        padding: 0 10px;
        border: 1.5px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 0.82rem;
        min-width: 140px;
        transition: border-color var(--trans-fast);
      }
      .filters select:focus { border-color: var(--clr-primary-500); }

      .table-card {
        background: #fff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-xl);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }
      .status-select {
        height: 30px;
        min-width: 120px;
        padding: 0 8px;
        border-radius: var(--radius-sm);
        border: 1.5px solid var(--border-default);
        background: #fff;
        font-size: 0.75rem;
        font-weight: 600;
        transition: border-color var(--trans-fast);
      }
      .status-select:focus { border-color: var(--clr-primary-500); outline: none; }
      .status-select:disabled { opacity: .6; cursor: not-allowed; }

      .st-PENDING    { background: #fef9c3; color: #854d0e; }
      .st-PROCESSING { background: #ffedd5; color: #9a3412; }
      .st-SHIPPED    { background: #dbeafe; color: #1e40af; }
      .st-DELIVERED  { background: #dcfce7; color: #166534; }
      .st-CANCELLED  { background: #fee2e2; color: #991b1b; }

      a { color: var(--clr-primary-600); text-decoration: none; font-size: 0.82rem; font-weight: 600; }
      a:hover { text-decoration: underline; }
    `
  ]
})
export class CorporateOrderListComponent {
  private readonly orders = inject(OrderService);
  private readonly currencyRates = inject(CurrencyRateService);
  private readonly router = inject(Router);
  readonly ctx = inject(CorporateContextService);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly items = signal<OrderSummaryResponse[]>([]);
  readonly status = signal<string>('');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly savingOrderIds = signal<Set<string>>(new Set());
  readonly displayCurrency = signal('');
  readonly usdRates = signal<Record<string, number>>({ USD: 1 });
  readonly availableCurrencies = signal<string[]>(['TRY', 'USD', 'EUR']);

  readonly formatMoney = formatMoney;
  readonly statusOptions = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

  constructor() {
    this.loadCurrencyRates();
    effect(() => {
      const sid = this.ctx.selectedStoreId();
      const st = this.status();
      this.fetch(sid, st);
    });
  }

  private fetch(sid: string | null, st: string): void {
    if (!this.isAdminRoute() && !sid) {
      this.loading.set(false);
      this.items.set([]);
      this.page.set(0);
      this.totalPages.set(0);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.orders
      .list({
        page: this.page(),
        size: 20,
        sort: 'orderDate,desc',
        status: st || undefined,
        storeId: this.isAdminRoute() ? undefined : sid ?? undefined
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

  onStatusChange(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.page.set(0);
    this.status.set(v);
  }

  onOrderStatusChange(order: OrderSummaryResponse, ev: Event): void {
    const select = ev.target as HTMLSelectElement;
    const status = select.value;
    if (!status || status === order.status) {
      return;
    }
    this.savingOrderIds.update((ids) => new Set(ids).add(order.orderId));
    this.orders.updateStatus(order.orderId, { status }).subscribe({
      next: (detail) => {
        this.items.update((items) =>
          items.map((item) =>
            item.orderId === order.orderId
              ? {
                  ...item,
                  status: detail.status,
                  paymentStatus: detail.paymentStatus,
                  grandTotal: detail.grandTotal,
                  currency: detail.currency
                }
              : item
          )
        );
        this.removeSavingOrder(order.orderId);
      },
      error: () => {
        select.value = order.status;
        this.removeSavingOrder(order.orderId);
      }
    });
  }

  isOrderSaving(orderId: string): boolean {
    return this.savingOrderIds().has(orderId);
  }

  statusOptionsFor(status: string): readonly string[] {
    const normalized = (status ?? '').toUpperCase();
    switch (normalized) {
      case 'PENDING':
        return ['PENDING', 'PROCESSING', 'CANCELLED'];
      case 'PROCESSING':
        return ['PROCESSING', 'SHIPPED', 'CANCELLED'];
      case 'SHIPPED':
        return ['SHIPPED', 'DELIVERED'];
      case 'DELIVERED':
        return ['DELIVERED'];
      case 'CANCELLED':
        return ['CANCELLED'];
      default:
        return [normalized || 'PENDING'];
    }
  }

  isStatusLocked(status: string): boolean {
    return this.statusOptionsFor(status).length <= 1;
  }

  setDisplayCurrency(value: string): void {
    const normalized = this.normalizeCurrency(value);
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

  onPageChange(page: number): void {
    this.page.set(page);
  }

  retry(): void {
    const sid = this.ctx.selectedStoreId();
    this.fetch(sid, this.status());
  }

  isAdminRoute(): boolean {
    return this.router.url.startsWith('/admin/');
  }

  detailLink(orderId: string): string[] {
    return [this.isAdminRoute() ? '/admin/orders' : '/corporate/orders', orderId];
  }

  badgeClass(s: string): string {
    const k = (s ?? '').toUpperCase();
    const known = new Set(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
    const cls = known.has(k) ? k : 'PENDING';
    return 'badge st-' + cls;
  }

  shortDate(s: string): string {
    return (s ?? '').slice(0, 16).replace('T', ' ');
  }

  private loadCurrencyRates(): void {
    this.currencyRates.listRates().subscribe({
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
        if (!this.displayCurrency()) {
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

  private removeSavingOrder(orderId: string): void {
    this.savingOrderIds.update((ids) => {
      const next = new Set(ids);
      next.delete(orderId);
      return next;
    });
  }
}
