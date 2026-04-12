import { Component, OnInit, computed, inject, signal } from '@angular/core';
import type { ChartData, ChartOptions } from 'chart.js';
import { forkJoin } from 'rxjs';

import { AnalyticsService } from '../../../core/api/analytics.service';
import type { AdminSummaryResponse, RankedProductResponse, RankedStoreResponse } from '../../../core/models/analytics.models';
import { ChartWrapperComponent } from '../../../shared/components/chart-wrapper/chart-wrapper.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { formatMoney } from '../../../shared/util/money';

type TrendTone = 'up' | 'neutral';
const DASHBOARD_PREFS_KEY = 'admin_dashboard_widget_prefs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [LoadingSpinnerComponent, ErrorStateComponent, ChartWrapperComponent],
  templateUrl: './admin-dashboard.component.html',
  styles: [
    `
      h2 {
        margin: 0 0 1rem;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin-bottom: 1.5rem;
      }
      .kpi {
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 12px 14px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        display: grid;
        gap: 8px;
      }
      .kpi-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .kpi label {
        display: block;
        font-size: 0.72rem;
        color: #64748b;
      }
      .kpi strong {
        font-size: 1.1rem;
        line-height: 1.15;
      }
      .trend {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.7rem;
        font-weight: 600;
        color: #475569;
      }
      .trend::before {
        content: '';
        display: inline-block;
      }
      .trend-up::before {
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 8px solid #16a34a;
      }
      .trend-neutral::before {
        width: 10px;
        height: 2px;
        background: #64748b;
        border-radius: 999px;
      }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
        gap: 16px;
        align-items: start;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 16px;
        background: #fff;
      }
      .chart-card {
        min-height: 380px;
      }
      h3 {
        font-size: 0.95rem;
        margin: 0 0 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      th,
      td {
        text-align: left;
        padding: 6px 4px;
        border-bottom: 1px solid #e2e8f0;
      }
      .chart-stack {
        display: grid;
        gap: 16px;
      }
      @media (max-width: 960px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class AdminDashboardComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly summary = signal<AdminSummaryResponse | null>(null);
  readonly topProducts = signal<RankedProductResponse[]>([]);
  readonly topStores = signal<RankedStoreResponse[]>([]);
  readonly showTopStoresWidget = signal(true);
  readonly showTopProductsWidget = signal(true);
  readonly topStoresFirst = signal(true);

  readonly formatMoney = formatMoney;

  readonly topStoresChartData = computed<ChartData<'bar'>>(() => ({
    labels: this.topStores().map((item) => item.storeName),
    datasets: [
      {
        label: 'Store revenue',
        data: this.topStores().map((item) => Number.parseFloat(item.totalRevenue)),
        backgroundColor: '#0f766e',
        borderRadius: 8,
        maxBarThickness: 48
      }
    ]
  }));

  readonly topProductsChartData = computed<ChartData<'bar'>>(() => ({
    labels: this.topProducts().map((item) => item.productTitle),
    datasets: [
      {
        label: 'Units sold',
        data: this.topProducts().map((item) => item.totalQuantitySold),
        backgroundColor: '#2563eb',
        borderRadius: 8,
        maxBarThickness: 36
      }
    ]
  }));

  readonly topStoresChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${formatMoney(String(ctx.raw ?? 0))}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#475569' },
        grid: { display: false }
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

  readonly topProductsChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.raw ?? 0} adet`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: '#475569' },
        grid: { color: '#e2e8f0' }
      },
      y: {
        ticks: { color: '#475569' },
        grid: { display: false }
      }
    }
  };

  ngOnInit(): void {
    this.restoreWidgetPrefs();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({
      s: this.analytics.adminSummary(),
      p: this.analytics.adminTopProducts(8),
      t: this.analytics.adminTopStores(8)
    }).subscribe({
      next: ({ s, p, t }) => {
        this.loading.set(false);
        this.summary.set(s);
        this.topProducts.set(p.items);
        this.topStores.set(t.items);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  trendTone(value: number | string): TrendTone {
    if (typeof value === 'number') {
      return value > 0 ? 'up' : 'neutral';
    }
    return Number.parseFloat(value) > 0 ? 'up' : 'neutral';
  }

  trendClass(tone: TrendTone): string {
    return `trend trend-${tone}`;
  }

  trendLabel(tone: TrendTone): string {
    return tone === 'up' ? 'Live +' : 'Live';
  }

  toggleWidget(widget: 'stores' | 'products', checked: boolean): void {
    if (widget === 'stores') {
      this.showTopStoresWidget.set(checked);
    } else {
      this.showTopProductsWidget.set(checked);
    }
    this.persistWidgetPrefs();
  }

  swapWidgetOrder(): void {
    this.topStoresFirst.set(!this.topStoresFirst());
    this.persistWidgetPrefs();
  }

  private restoreWidgetPrefs(): void {
    const raw = localStorage.getItem(DASHBOARD_PREFS_KEY);
    if (!raw) return;
    try {
      const prefs = JSON.parse(raw) as {
        showTopStoresWidget?: boolean;
        showTopProductsWidget?: boolean;
        topStoresFirst?: boolean;
      };
      this.showTopStoresWidget.set(prefs.showTopStoresWidget ?? true);
      this.showTopProductsWidget.set(prefs.showTopProductsWidget ?? true);
      this.topStoresFirst.set(prefs.topStoresFirst ?? true);
    } catch {
      localStorage.removeItem(DASHBOARD_PREFS_KEY);
    }
  }

  private persistWidgetPrefs(): void {
    localStorage.setItem(
      DASHBOARD_PREFS_KEY,
      JSON.stringify({
        showTopStoresWidget: this.showTopStoresWidget(),
        showTopProductsWidget: this.showTopProductsWidget(),
        topStoresFirst: this.topStoresFirst()
      })
    );
  }
}
