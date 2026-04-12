import { Component, computed, effect, inject, signal } from '@angular/core';
import type { ChartData, ChartOptions } from 'chart.js';

import { AnalyticsService } from '../../../core/api/analytics.service';
import { CorporateContextService } from '../../../core/corporate/corporate-context.service';
import type { StoreRevenueResponse } from '../../../core/models/analytics.models';
import { ChartWrapperComponent } from '../../../shared/components/chart-wrapper/chart-wrapper.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

@Component({
  selector: 'app-corporate-analytics',
  standalone: true,
  imports: [LoadingSpinnerComponent, ErrorStateComponent, EmptyStateComponent, ChartWrapperComponent],
  templateUrl: './analytics.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .hint {
        margin: 0 0 1rem;
        color: #64748b;
        font-size: 0.9rem;
      }
      .chart-card {
        max-width: 760px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        background: #fff;
      }
      .table {
        margin-top: 1rem;
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
      }
      .table th,
      .table td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      .amt {
        text-align: right;
      }
    `
  ]
})
export class CorporateAnalyticsComponent {
  private readonly analytics = inject(AnalyticsService);
  readonly ctx = inject(CorporateContextService);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly rows = signal<StoreRevenueResponse[]>([]);

  readonly formatMoney = formatMoney;

  readonly chartData = computed<ChartData<'bar'>>(() => ({
    labels: this.rows().map((r) => r.storeName),
    datasets: [
      {
        label: 'Toplam ciro',
        data: this.rows().map((r) => Number.parseFloat(r.totalRevenue)),
        backgroundColor: '#2563eb',
        borderRadius: 8,
        maxBarThickness: 56
      }
    ]
  }));

  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${formatMoney(String(ctx.raw ?? 0))}`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#475569'
        },
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#475569',
          callback: (value) => formatMoney(String(value))
        }
      }
    }
  };

  constructor() {
    effect(() => {
      const sid = this.ctx.selectedStoreId();
      if (!sid) {
        this.loading.set(false);
        this.rows.set([]);
        return;
      }
      this.load(sid);
    });
  }

  load(storeId: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.analytics.corporateRevenueByStore(storeId).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.rows.set(res.items);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  retry(): void {
    const sid = this.ctx.selectedStoreId();
    if (sid) this.load(sid);
  }
}
