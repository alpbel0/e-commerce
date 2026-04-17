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
      h2 {
        margin: 0 0 0.5rem;
      }
      .hint {
        margin: 0 0 1rem;
        font-size: 0.85rem;
        color: #64748b;
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: end;
        margin-bottom: 1rem;
      }
      .filters select {
        padding: 0.4rem 0.6rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
      .filters label {
        display: grid;
        gap: 4px;
        font-size: 0.82rem;
        color: #475569;
      }
      .status-select {
        min-width: 130px;
        padding: 0.3rem 0.45rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #fff;
        font-size: 0.78rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
      }
      th,
      td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
      }
      .st-PENDING {
        background: #fef9c3;
        color: #854d0e;
      }
      .st-PROCESSING {
        background: #ffedd5;
        color: #9a3412;
      }
      .st-SHIPPED {
        background: #fed7aa;
        color: #c2410c;
      }
      .st-DELIVERED {
        background: #dcfce7;
        color: #166534;
      }
      .st-CANCELLED {
        background: #fee2e2;
        color: #991b1b;
      }
      a {
        color: #2563eb;
        text-decoration: none;
      }
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
    const status = (ev.target as HTMLSelectElement).value;
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
      error: () => this.removeSavingOrder(order.orderId)
    });
  }

  isOrderSaving(orderId: string): boolean {
    return this.savingOrderIds().has(orderId);
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
