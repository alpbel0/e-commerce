import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { CurrencyRateService } from '../../../../core/api/currency-rate.service';
import { OrderService } from '../../../../core/api/order.service';
import type { OrderSummaryResponse } from '../../../../core/models/order.models';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { formatMoney } from '../../../../shared/util/money';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LoadingSpinnerComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    PaginationComponent
  ],
  templateUrl: './order-list.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: end;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .filters label {
        display: grid;
        gap: 4px;
        font-size: 0.8rem;
        color: #475569;
      }
      .filters select,
      .filters input {
        padding: 0.4rem 0.6rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        min-width: 160px;
      }
      .export {
        padding: 0.45rem 0.8rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
      }
      .currency-picker {
        display: flex;
        align-items: end;
        gap: 8px;
      }
      .currency-picker label {
        display: grid;
        gap: 4px;
        font-size: 0.8rem;
        color: #475569;
      }
      .currency-picker select {
        min-width: 130px;
        padding: 0.4rem 0.6rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
      .toolbar-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: end;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      th,
      td {
        text-align: left;
        padding: 10px 8px;
        border-bottom: 1px solid #e2e8f0;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.72rem;
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
      a:hover {
        text-decoration: underline;
      }
    `
  ]
})
export class OrderListComponent {
  private readonly orders = inject(OrderService);
  private readonly currencyRates = inject(CurrencyRateService);

  readonly items = signal<OrderSummaryResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly status = signal<string>('');
  readonly paymentStatus = signal<string>('');
  readonly storeQuery = signal('');
  readonly displayCurrency = signal('');
  readonly usdRates = signal<Record<string, number>>({ USD: 1 });
  readonly availableCurrencies = signal<string[]>(['TRY', 'USD', 'EUR']);

  readonly formatMoney = formatMoney;
  readonly statusOptions = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
  readonly paymentStatusOptions = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;

  readonly filteredItems = computed(() => {
    const paymentStatus = this.paymentStatus();
    const query = this.storeQuery().trim().toLowerCase();
    return this.items().filter((item) => {
      const matchesPayment = !paymentStatus || item.paymentStatus === paymentStatus;
      const matchesQuery = !query || item.storeName.toLowerCase().includes(query) || item.incrementId.toLowerCase().includes(query);
      return matchesPayment && matchesQuery;
    });
  });

  constructor() {
    this.loadCurrencyRates();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    const status = this.status();
    this.orders
      .list({
        page: this.page(),
        size: 15,
        sort: 'orderDate,desc',
        status: status || undefined
      })
      .subscribe({
        next: (response) => {
          this.loading.set(false);
          this.items.set(response.items);
          this.totalPages.set(response.totalPages);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        }
      });
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.status.set(value);
    this.page.set(0);
    this.load();
  }

  onPaymentStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.paymentStatus.set(value);
  }

  onStoreQueryChange(value: string): void {
    this.storeQuery.set(value);
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

  onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  exportCsv(): void {
    const rows = this.filteredItems();
    const header = ['Order No', 'Store', 'Order Status', 'Payment Status', 'Total', 'Date'];
    const lines = rows.map((row) =>
      [
        row.incrementId,
        row.storeName,
        row.status,
        row.paymentStatus,
        this.formatDisplayMoney(row.grandTotal, row.currency),
        row.orderDate
      ]
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `purchase-history-page-${this.page() + 1}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  }

  badgeClass(status: string): string {
    const key = (status ?? '').toUpperCase();
    const known = new Set(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
    const safeKey = known.has(key) ? key : 'PENDING';
    return 'badge st-' + safeKey;
  }

  shortDate(value: string): string {
    return (value ?? '').slice(0, 10);
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
}
