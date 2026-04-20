import { DecimalPipe } from '@angular/common';
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
type DashboardCurrency = 'TRY' | 'USD' | 'EUR';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [LoadingSpinnerComponent, ErrorStateComponent, ChartWrapperComponent, DecimalPipe],
  templateUrl: './admin-dashboard.component.html',
  styles: [`
    /* Page header */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 28px;
    }
    .page-header__title {
      font-size: 1.5rem;
      font-weight: 800;
      margin-bottom: 2px;
    }
    .page-header__sub { font-size: 0.875rem; color: var(--text-muted); }
    .page-header__actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .page-header__actions select {
      min-width: 96px;
      height: 40px;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--surface-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 18px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--trans-base), transform var(--trans-fast);
    }
    .kpi-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
    .kpi-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      flex-shrink: 0;
    }
    .kpi-card__icon--green  { background: #d1fae5; color: #059669; }
    .kpi-card__icon--blue   { background: #dbeafe; color: #1d4ed8; }
    .kpi-card__icon--purple { background: #ede9fe; color: #7c3aed; }
    .kpi-card__icon--amber  { background: #fef3c7; color: #d97706; }
    .kpi-card__icon--rose   { background: #ffe4e6; color: #e11d48; }
    .kpi-card__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .kpi-card__label {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .kpi-card__value {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1.15;
    }
    .trend {
      font-size: 0.68rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .trend-up    { color: #059669; }
    .trend-neutral { color: var(--text-muted); }

    /* Widget controls */
    .widget-controls {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 12px 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .widget-controls__title {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-secondary);
    }
    .widget-controls__toggles {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .toggle-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .toggle-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      border-radius: 4px;
    }

    /* Charts grid */
    .charts-grid {
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      gap: 20px;
      align-items: start;
    }
    .charts-col { display: flex; flex-direction: column; gap: 20px; }

    /* Section card */
    .section-card { padding: 20px; }
    .section-card__title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    .chart-area { height: 300px; }

    /* Table extras */
    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: var(--clr-slate-100);
      border-radius: 50%;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-secondary);
    }
    .product-name {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .revenue-cell { font-weight: 600; color: var(--text-primary); }

    @media (max-width: 960px) {
      .charts-grid { grid-template-columns: 1fr; }
    }
  `]
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
  readonly selectedCurrency = signal<DashboardCurrency>('TRY');

  readonly currencyOptions: Array<{ code: DashboardCurrency; label: string }> = [
    { code: 'TRY', label: 'TL' },
    { code: 'USD', label: 'USD' },
    { code: 'EUR', label: 'EUR' }
  ];

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
          label: (ctx) => {
            const store = this.topStores()[ctx.dataIndex];
            return ` ${formatMoney(store?.totalRevenue ?? '0', this.selectedCurrency())}`;
          }
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
          callback: (value) => formatMoney(String(value), this.selectedCurrency())
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
    const currency = this.selectedCurrency();
    forkJoin({
      s: this.analytics.adminSummary(currency),
      p: this.analytics.adminTopProducts({ limit: 8, currency }),
      t: this.analytics.adminTopStores(8, currency)
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

  onCurrencyChange(currency: string): void {
    if (currency === 'TRY' || currency === 'USD' || currency === 'EUR') {
      this.selectedCurrency.set(currency);
      this.persistWidgetPrefs();
      this.load();
    }
  }

  private restoreWidgetPrefs(): void {
    const raw = localStorage.getItem(DASHBOARD_PREFS_KEY);
    if (!raw) return;
    try {
      const prefs = JSON.parse(raw) as {
        showTopStoresWidget?: boolean;
        showTopProductsWidget?: boolean;
        topStoresFirst?: boolean;
        selectedCurrency?: DashboardCurrency;
      };
      this.showTopStoresWidget.set(prefs.showTopStoresWidget ?? true);
      this.showTopProductsWidget.set(prefs.showTopProductsWidget ?? true);
      this.topStoresFirst.set(prefs.topStoresFirst ?? true);
      this.selectedCurrency.set(prefs.selectedCurrency ?? 'TRY');
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
        topStoresFirst: this.topStoresFirst(),
        selectedCurrency: this.selectedCurrency()
      })
    );
  }
}
