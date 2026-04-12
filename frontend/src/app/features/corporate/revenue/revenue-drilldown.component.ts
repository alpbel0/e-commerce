import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ChartData, ChartOptions } from 'chart.js';

import { OrderService } from '../../../core/api/order.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import type { OrderSummaryResponse } from '../../../core/models/order.models';
import { ChartWrapperComponent } from '../../../shared/components/chart-wrapper/chart-wrapper.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-revenue-drilldown',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent, ChartWrapperComponent],
  templateUrl: './revenue-drilldown.component.html',
  styles: [
    `
      .toolbar {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 1rem;
      }
      .toolbar label {
        display: grid;
        gap: 4px;
        font-size: 0.8rem;
      }
      .toolbar select {
        padding: 0.4rem 0.55rem;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }
      .panel {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        background: #fff;
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
    `
  ]
})
export class RevenueDrilldownComponent {
  private readonly orders = inject(OrderService);
  readonly ctx = inject(CorporateContextService);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly items = signal<OrderSummaryResponse[]>([]);
  readonly range = signal<'30' | '90' | 'all'>('90');
  readonly monthlyChart = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  readonly statusChart = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => formatMoney(String(value)) }
      }
    }
  };

  readonly countChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true }
    }
  };

  constructor() {
    effect(() => {
      const storeId = this.ctx.selectedStoreId();
      const range = this.range();
      if (!storeId) {
        this.items.set([]);
        return;
      }
      this.load(storeId, range);
    });
  }

  load(storeId: string, range: '30' | '90' | 'all'): void {
    this.loading.set(true);
    this.error.set(false);
    this.orders.list({ page: 0, size: 100, sort: 'orderDate,desc', storeId }).subscribe({
      next: (response) => {
        this.loading.set(false);
        const filtered = this.filterByRange(response.items, range);
        this.items.set(filtered);
        this.monthlyChart.set(this.buildMonthlyRevenueChart(filtered));
        this.statusChart.set(this.buildStatusChart(filtered));
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  onRangeChange(value: string): void {
    this.range.set(value === '30' || value === '90' || value === 'all' ? value : '90');
  }

  totalRevenue(): string {
    const total = this.items().reduce((sum, item) => sum + Number.parseFloat(item.grandTotal), 0);
    return total.toFixed(2);
  }

  private filterByRange(items: OrderSummaryResponse[], range: '30' | '90' | 'all'): OrderSummaryResponse[] {
    if (range === 'all') return items;
    const days = Number.parseInt(range, 10);
    const now = Date.now();
    return items.filter((item) => now - new Date(item.orderDate).getTime() <= days * 24 * 60 * 60 * 1000);
  }

  private buildMonthlyRevenueChart(items: OrderSummaryResponse[]): ChartData<'bar'> {
    const monthly = new Map<string, number>();
    for (const item of items) {
      const key = item.orderDate.slice(0, 7);
      monthly.set(key, (monthly.get(key) ?? 0) + Number.parseFloat(item.grandTotal));
    }
    return {
      labels: [...monthly.keys()],
      datasets: [
        {
          label: 'Revenue',
          data: [...monthly.values()],
          backgroundColor: '#2563eb',
          borderRadius: 8
        }
      ]
    };
  }

  private buildStatusChart(items: OrderSummaryResponse[]): ChartData<'bar'> {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    }
    return {
      labels: [...counts.keys()],
      datasets: [
        {
          label: 'Orders',
          data: [...counts.values()],
          backgroundColor: '#0f766e',
          borderRadius: 8
        }
      ]
    };
  }
}
