import { Component, effect, inject, signal } from '@angular/core';
import type { ChartData, ChartOptions } from 'chart.js';

import { OrderService } from '../../../core/api/order.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import type { OrderSummaryResponse } from '../../../core/models/order.models';
import { ChartWrapperComponent } from '../../../shared/components/chart-wrapper/chart-wrapper.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

interface CustomerSegmentRow {
  email: string;
  orderCount: number;
  totalSpent: number;
  segment: 'High Value' | 'Repeat' | 'One Time';
}

@Component({
  selector: 'app-customer-insights',
  standalone: true,
  imports: [LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent, ChartWrapperComponent],
  templateUrl: './customer-insights.component.html',
  styles: [
    `
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin-bottom: 1rem;
      }
      .stat, .panel {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #fff;
        padding: 14px;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      @media (max-width: 960px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class CustomerInsightsComponent {
  private readonly orders = inject(OrderService);
  readonly ctx = inject(CorporateContextService);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly rows = signal<CustomerSegmentRow[]>([]);
  readonly chartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true }
    }
  };

  readonly formatMoney = formatMoney;

  constructor() {
    effect(() => {
      const storeId = this.ctx.selectedStoreId();
      if (!storeId) {
        this.rows.set([]);
        this.chartData.set({ labels: [], datasets: [] });
        return;
      }
      this.load(storeId);
    });
  }

  load(storeId: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.orders.list({ page: 0, size: 100, sort: 'orderDate,desc', storeId }).subscribe({
      next: (response) => {
        this.loading.set(false);
        const rows = this.buildSegments(response.items);
        this.rows.set(rows);
        this.chartData.set({
          labels: ['High Value', 'Repeat', 'One Time'],
          datasets: [
            {
              label: 'Customers',
              data: [
                rows.filter((row) => row.segment === 'High Value').length,
                rows.filter((row) => row.segment === 'Repeat').length,
                rows.filter((row) => row.segment === 'One Time').length
              ],
              backgroundColor: ['#0f766e', '#2563eb', '#64748b'],
              borderRadius: 8
            }
          ]
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  private buildSegments(items: OrderSummaryResponse[]): CustomerSegmentRow[] {
    const byCustomer = new Map<string, CustomerSegmentRow>();
    for (const item of items) {
      const email = item.customerEmail || 'unknown@customer';
      const total = Number.parseFloat(item.grandTotal);
      const current = byCustomer.get(email) ?? { email, orderCount: 0, totalSpent: 0, segment: 'One Time' };
      current.orderCount += 1;
      current.totalSpent += Number.isFinite(total) ? total : 0;
      byCustomer.set(email, current);
    }
    return [...byCustomer.values()]
      .map((row) => ({
        ...row,
        segment: (row.totalSpent >= 1000 ? 'High Value' : row.orderCount >= 2 ? 'Repeat' : 'One Time') as
          | 'High Value'
          | 'Repeat'
          | 'One Time'
      }))
      .sort((left, right) => right.totalSpent - left.totalSpent);
  }

  totalCustomers(): number {
    return this.rows().length;
  }

  repeatCustomers(): number {
    return this.rows().filter((row) => row.segment === 'Repeat').length;
  }

  highValueCustomers(): number {
    return this.rows().filter((row) => row.segment === 'High Value').length;
  }
}
